package org.nrg.xnatx.plugins.pixi.bli.importer;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.nrg.action.ClientException;
import org.nrg.action.ServerException;
import org.nrg.framework.constants.PrearchiveCode;
import org.nrg.xdat.XDAT;
import org.nrg.xdat.om.ArcProject;
import org.nrg.xdat.om.XnatProjectdata;
import org.nrg.xft.security.UserI;
import org.nrg.xft.utils.fileExtraction.Format;
import org.nrg.xnat.helpers.ZipEntryFileWriterWrapper;
import org.nrg.xnat.helpers.prearchive.*;
import org.nrg.xnat.helpers.uri.URIManager;
import org.nrg.xnat.restlet.actions.importer.ImporterHandler;
import org.nrg.xnat.restlet.actions.importer.ImporterHandlerA;
import org.nrg.xnat.restlet.util.FileWriterWrapperI;
import org.nrg.xnat.services.messaging.prearchive.PrearchiveOperationRequest;
import org.nrg.xnat.turbine.utils.ArcSpecManager;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.nrg.xnat.archive.Operation.Rebuild;

/**
 * An import handler for BLI sessions.
 *
 * Supports ZIP uploads of a BLI session. Each directory in the folder is assumed to be a single session.
 *
 * TODO Parameters in AnalyzedClickInfo.txt
 */
@ImporterHandler(handler = BliImporter.BLI_IMPORTER)
@Slf4j
public class BliImporter extends ImporterHandlerA {
    public static final String BLI_IMPORTER = "BLI";

    private final InputStream in;
    private final UserI user;
    private final Map<String, Object> params;
    private final Format format;
    private final Date uploadDate;
    private final Set<String> uris;
    private final Set<Path> timestampDirectories;
    private final Set<SessionData> sessions;
    private static final String UNKNOWN_SESSION_LABEL = "bli_zip_upload";

    public BliImporter(final Object listenerControl,
                       final UserI user,
                       final FileWriterWrapperI fw,
                       final Map<String, Object> params) throws IOException {
        super(listenerControl, user);
        this.user = user;
        this.params = params;
        this.in = fw.getInputStream();
        this.format = Format.getFormat(fw.getName());
        this.uploadDate = new Date();
        this.uris = Sets.newLinkedHashSet();
        this.timestampDirectories = Sets.newLinkedHashSet();
        this.sessions = Sets.newLinkedHashSet();
    }

    @Override
    public List<String> call() throws ClientException, ServerException {
        // Project ID is required
        if (!params.containsKey(URIManager.PROJECT_ID)) {
            ClientException e = new ClientException("PROJECT_ID is a required parameter for BLI session uploads.");
            log.error("Project ID required for BLI session uploads", e);
            throw e;
        }

        String projectId = (String) params.get(URIManager.PROJECT_ID);

        // Only accepting ZIP format
        if (format == Format.ZIP) {
            try (final ZipInputStream zin = new ZipInputStream(in)) {
                log.info("Zip file received by BLI importer.");

                ZipEntry ze = zin.getNextEntry();
                while (null != ze) {
                    // Each directory contains a single BLI session
                    if (ze.isDirectory()) {
                        // importDirectory(...) returns the next zip entry
                        ze = importDirectory(projectId, ze, zin);
                    }
                }
            } catch (IOException e) {
                log.error("Error uploading BLI session.", e);
                cleanupOnImportFailure();
                throw new ServerException(e);
            } catch (ServerException | ClientException e) {
                log.error("Error uploading BLI session.", e);
                cleanupOnImportFailure();
                throw e;
            }
        } else {
            ClientException e = new ClientException("Unsupported format " + format);
            log.error("Unsupported format: {}", format);
            throw e;
        }

        // Send a build request after all sessions have been imported
        sessions.forEach(this::sendSessionBuildRequest);

        return Lists.newArrayList(uris);
    }

    /**
     * Each directory must contain a single BLI session. This method imports a single BLI session and saves it to the
     * prearchive database
     *
     * @param ze   The ZipEntry of the directory
     * @param zin  The ZipInputStream containing the entire submission (could be more than one session)
     *
     * @return ZipEntry The next ZipEntry
     */
    protected ZipEntry importDirectory(final String projectId, ZipEntry ze, ZipInputStream zin) throws IOException, ServerException, ClientException {
        final String directoryName = ze.getName();
        log.info("Importing directory: {}", directoryName);


        // Create prearchive timestamp
        final String timestamp = PrearcUtils.makeTimestamp();

        // Initialize the session and session metadata
        SessionData session = new SessionData();
        Optional<String> subjectId = Optional.empty();
        Optional<String> sessionLabel = Optional.empty();
        Optional<String> scanLabel = Optional.empty();
        Optional<String> uid = Optional.empty();
        Optional<Date> scanDate = Optional.empty();

        boolean analyzedClickInfoRead = false;

        // Get Subject and Session labels if they've been provided
        if (params.containsKey(URIManager.SUBJECT_ID)) {
            subjectId = Optional.of((String) params.get(URIManager.SUBJECT_ID));
            log.debug("Subject ID set in input/URI parameters: {}", subjectId);
        }

        if (params.containsKey(URIManager.EXPT_LABEL)) {
            sessionLabel = Optional.of((String) params.get(URIManager.EXPT_LABEL));
            log.debug("Session Label set in input/URI parameters: {}", sessionLabel);
        }

        // Initialize the prearchive directory
        Path prearchiveTimestampPath = Paths.get(ArcSpecManager.GetInstance().getGlobalPrearchivePath(), projectId, timestamp);
        Path prearchiveTempDirectoryPath = prearchiveTimestampPath.resolve(UNKNOWN_SESSION_LABEL);

        // Import files to prearchive temp directory
        ze = zin.getNextEntry();

        if (ze == null || ze.isDirectory()) {
            return ze;
        }

        // Once you've reached the next directory all the files for this session should have been imported
        while (null != ze && !ze.isDirectory()) {
            // Get the file name
            String fullFileName = ze.getName();
            String[] splitFileName = fullFileName.split("/");
            String fileName = splitFileName[splitFileName.length - 1];

            log.info("Importing file: {}", ze.getName());

            // Create file in the prearchive
            Path prearchiveFile = prearchiveTempDirectoryPath.resolve(fileName);

            if (Files.notExists(prearchiveTempDirectoryPath)) {
                timestampDirectories.add(prearchiveTimestampPath); // Keep track of timestamp paths, will delete these folders in case of error
                Files.createDirectories(prearchiveTempDirectoryPath);
            }

            Files.createFile(prearchiveFile);

            // AnalyzedClickInfo.txt is the header file and contains all session metadata
            // Other file can be directly save to the prearchive
            if (fileName.equalsIgnoreCase("AnalyzedClickInfo.txt")) {
                log.info("Parsing AnalyzedClickInfo.txt for session metadata.");

                // Need to write this file as it's read/scanned from the input stream
                FileWriter fileWriter = new FileWriter(prearchiveFile.toFile());

                // Scanner will find the subject and session labels if they weren't already provided
                Scanner analyzedClickInfoScanner = new Scanner(zin);

                while (analyzedClickInfoScanner.hasNextLine()) {
                    String line = analyzedClickInfoScanner.nextLine();
                    fileWriter.write(line);
                    fileWriter.write("\n");

                    // File should be colon delineated
                    String[] splitLine = line.split(":");

                    if (splitLine.length == 2) {

                        String key = splitLine[0];
                        String value = splitLine[1].trim();

                        switch (key.toLowerCase()) {
                            case ("experiment"): {
                                // TODO Determine Unique Session Label / Experiment Field
                                if (!sessionLabel.isPresent()) {
                                    sessionLabel = Optional.of(replaceWhitespace(value));
                                    log.debug("Session Label found in AnalyzedClickInfo.txt: {}", sessionLabel.get());
                                }
                                break;
                            }
                            case ("animal number"): {
                                // TODO They are not using animal number field. Can we get them to use it instead of the comment field? Can the animal number field include commas?
                                if (!subjectId.isPresent()) {

                                    // TODO Can we store hotel sessions under one subject?
                                    // Hotel Session - Comma separated list of animal numbers
                                    if (value.contains(",")) {
                                        subjectId = Optional.of("Hotel");
                                    } else {
                                        subjectId = Optional.of(value);
                                    }
                                }
                                break;
                            }
                            case ("*** luminescent image"): {
                                // There is a few dates in AnalyzedClickInfo.txt but they should all be the same unless they were scanning at midnight(!!)
                                String acqDate = analyzedClickInfoScanner.nextLine();
                                acqDate = acqDate.split(":")[1];
                                acqDate = acqDate.trim();

                                try {
                                    SimpleDateFormat dateFormat = new SimpleDateFormat("EEEE, MMMM dd, yyyy");
                                    scanDate = Optional.of(dateFormat.parse(acqDate));
                                } catch (ParseException e) {
                                    log.warn("Unable to parse scan date.");
                                }

                                break;
                            }
                            case ("view"): {
                                // TODO: Can we use the view field for prone / supine? Is view -> orientation?
                                // Dorsal / Ventral / Prone / Supine orientation will be used for scan labels
                                if (!scanLabel.isPresent()) {
                                    scanLabel = Optional.of(replaceWhitespace(value));
                                }
                                break;
                            }
                            case("***  clicknumber"): {
                                // Not sure if there is really a UID for BLI. XNAT requires one and this seems like the best option.
                                if (!uid.isPresent()) {
                                    uid = Optional.of(replaceWhitespace(value));
                                }
                                break;
                            }

                        }
                    }
                }

                // Finished parsing AnalyzedClickInfo.txt
                fileWriter.flush();
                fileWriter.close();

                analyzedClickInfoRead = true;

                // Populate session
                session.setFolderName(sessionLabel.orElse(UNKNOWN_SESSION_LABEL));
                session.setName(sessionLabel.orElse(UNKNOWN_SESSION_LABEL));
                session.setProject(projectId);
                session.setScan_date(scanDate.orElse(null));
                session.setUploadDate(uploadDate);
                session.setTimestamp(timestamp);
                session.setStatus(PrearcUtils.PrearcStatus.RECEIVING);
                session.setLastBuiltDate(Calendar.getInstance().getTime());
                session.setSubject(subjectId.orElse(null));
                session.setSource(params.get(URIManager.SOURCE));
                session.setPreventAnon(Boolean.valueOf((String) params.get(URIManager.PREVENT_ANON)));
                session.setPreventAutoCommit(Boolean.valueOf((String) params.get(URIManager.PREVENT_AUTO_COMMIT)));
                session.setAutoArchive(shouldAutoArchive(projectId));

            } else {
                // Not AnalyzedClickInfo.txt, file can be written to prearchive. Nothing to parse
                ZipEntryFileWriterWrapper zipEntryFileWriterWrapper = new ZipEntryFileWriterWrapper(ze,zin);
                zipEntryFileWriterWrapper.write(prearchiveFile.toFile());
            }

            ze = zin.getNextEntry();
        }

        if (analyzedClickInfoRead) {

            if (!scanLabel.isPresent()) {
                if (uid.isPresent()) {
                    scanLabel = uid;
                } else {
                    scanLabel = Optional.of(UUID.randomUUID().toString());
                }
            }

            Optional<SessionData> matchingSession = sessions.stream().filter(s -> s.getProject().equals(session.getProject()) &&
                                                                                  s.getFolderName().equals(session.getFolderName()) &&
                                                                                  s.getName().equals(session.getName()) &&
                                                                                  s.getSubject().equals(session.getSubject()) &&
                                                                                  (!s.getName().equalsIgnoreCase(UNKNOWN_SESSION_LABEL) ||
                                                                                   !session.getName().equalsIgnoreCase(UNKNOWN_SESSION_LABEL))).findAny();

            Path sessionFolder = Paths.get(prearchiveTimestampPath.toString(), sessionLabel.orElse(UNKNOWN_SESSION_LABEL));
            Path scanFolder = Paths.get(sessionFolder.toString(), "SCANS", scanLabel.get());

            if (matchingSession.isPresent()) {
                scanFolder = Paths.get(matchingSession.get().getUrl(), "SCANS", scanLabel.get());
                transferFiles(prearchiveTempDirectoryPath, scanFolder, prearchiveTimestampPath);
                log.debug("Merging with existing session. Project: {} Subject: {} Session: {} Scan: {}", projectId, subjectId, sessionLabel, scanLabel);
                // No need for PrearcDatabase.addSession(), session should have already been added
            } else {
                transferFiles(prearchiveTempDirectoryPath, scanFolder);
                session.setUrl(sessionFolder.toString());

                try {
                    PrearcDatabase.addSession(session);
                    log.debug("Added session to prearchive database. Project: {} Subject: {} Session: {} Scan: {}", projectId, subjectId, sessionLabel, scanLabel);
                } catch (Exception e) {
                    log.error("Unable to add BLI session", e);
                    throw new ServerException(e);
                }

                sessions.add(session);
                uris.add(sessionFolder.toString());
            }

        } else {
            log.error("AnalyzedClickInfo.txt is missing from session directory {}", directoryName);
            FileUtils.deleteDirectory(prearchiveTimestampPath.toFile());
            throw new ClientException("Unable to create a BLI session. AnalyzedClickInfo.txt is missing from session directory " + directoryName);
        }

        return ze;
    }

    // TODO Put in core xnat??
    private PrearchiveCode shouldAutoArchive(final String projectId) {
        if (null == projectId) {
            return null;
        }

        XnatProjectdata project = XnatProjectdata.getXnatProjectdatasById(projectId, user, false);

        if (project == null) {
            return null;
        }

        ArcProject arcProject = project.getArcSpecification();
        if (arcProject == null) {
            log.warn("Tried to get the arc project from project {}, but got null in return. Returning null for the " +
                             "prearchive code, but it's probably not good that the arc project wasn't found.", project.getId());
            return null;
        }
        return PrearchiveCode.code(arcProject.getPrearchiveCode());
    }

    /**
     * We don't know much about the BLI session until AnalyzedClickInfo.txt is parsed so everything is stored in a
     * temporary session directory. This method is used to transfer files from temporary directory to a scan directory.
     *
     * @param temporarySessionFolder Directory used to temporary store the session
     * @param scanFolder The scan directory to move the files to.
     *
     * @throws IOException If the new directory can't be created, the files can't be moved, or the temp directory
     *                     can't be deleted.
     */
    private void transferFiles(Path temporarySessionFolder, Path scanFolder) throws IOException {
        // mkdir if it doesnt exist
        if (Files.notExists(scanFolder)) {
            Files.createDirectories(scanFolder);
        }

        // Move each file individually
        try (DirectoryStream<Path> tempFileStream = Files.newDirectoryStream(temporarySessionFolder)) {
            for (Path tempFile: tempFileStream) {
                Files.move(tempFile, scanFolder.resolve(tempFile.getFileName()));
            }
        }

        // Delete the temporary session folder
        Files.delete(temporarySessionFolder);
    }

    /**
     * Transfers files from the temporary session directory to the scan directory and deletes the timestamp folder which
     * contained the temporary session directory. Use this method when adding scans to an existing session.
     *
     * @param temporarySessionFolder Directory used to temporary store the session
     * @param scanFolder The scan directory to move the files to.
     * @param timestampFolder The parent directory of the temporary session. This directory will be deleted after
     *                        transferring files to the scan directory.
     *
     * @throws IOException If the new directory can't be created, the files can't be moved, the temp directory can't be
 *                         deleted, or the timestamp directory can't be deleted.
     */
    private void transferFiles(Path temporarySessionFolder, Path scanFolder, Path timestampFolder) throws IOException {
        // Transfer files
        transferFiles(temporarySessionFolder, scanFolder);
        // Then delete the timestamp folder
        Files.delete(timestampFolder);
    }

    /**
     * If something goes wrong with the import process, delete all the timestamp directories and delete sessions from
     * the prearchive database
     */
    private void cleanupOnImportFailure() {
        try {
            for (Path timestampDirectory : timestampDirectories) {
                FileUtils.deleteDirectory(timestampDirectory.toFile());
            }

            for (SessionData session : sessions) {
                PrearcDatabase.deleteSession(session.getName(), session.getTimestamp(), session.getProject());
            }
        } catch (Exception e) {
            log.error("Error deleting sessions from the prearchive", e);
        }
    }

    /**
     * Replaces whitespaces with underscores. Needed for various XNAT labels / ids.
     *
     * @param string String to replace whitespaces with underscores
     *
     * @return String with whitespaces replaced with underscores.
     */
    private String replaceWhitespace(String string) {
        if (string == null) {
            return null;
        }

        return string.replaceAll("\\s","_");
    }

    /**
     * Send a session build request for each session in the prearchive instead of waiting for the
     * 'Session Time Interval' to elapse. If the request can't be sent, then the time interval will kick in instead.
     *
     * @param sessionData The session to request a build for.
     */
    private void sendSessionBuildRequest(SessionData sessionData) {
        try {
            final File sessionDir = PrearcUtils.getPrearcSessionDir(user, sessionData.getProject(), sessionData.getTimestamp(), sessionData.getFolderName(), false);
            XDAT.sendJmsRequest(new PrearchiveOperationRequest(user, Rebuild, sessionData, sessionDir));
        } catch (Exception e) {
            log.info("Unable to request session build. Sitewide prearchive settings will be used instead.");
        }
    }

}
