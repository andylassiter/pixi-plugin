package org.nrg.xnatx.plugins.pixi.bli.sessionBuilder;

import lombok.extern.slf4j.Slf4j;
import org.apache.ecs.wml.B;
import org.nrg.session.SessionBuilder;
import org.nrg.xdat.bean.PixiBlisessiondataBean;
import org.nrg.xdat.bean.XnatImagesessiondataBean;
import org.nrg.xdat.bean.XnatInvestigatordataBean;
import org.nrg.xdat.model.XnatImagescandataI;
import org.nrg.xnat.helpers.prearchive.PrearcUtils;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
public class BliSessionBuilder extends SessionBuilder {

    private final File sessionDir;

    public BliSessionBuilder(final File sessionDir, final Writer fileWriter) {
        super(sessionDir, sessionDir.getPath(), fileWriter);
        this.sessionDir = sessionDir;
    }

    @Override
    public String getSessionInfo() {
        // TODO
        return "(undetermined)";
    }

    @Override
    public XnatImagesessiondataBean call() throws Exception {
        // TODO Throw NoUniqueSessionException

        // Get proj/subj/sess/... parameters
        Map<String, String> parameters = getParameters();
        String project = parameters.getOrDefault(PrearcUtils.PARAM_PROJECT, null);
        String subject = parameters.getOrDefault(PrearcUtils.PARAM_SUBJECT_ID, null);
        String label = parameters.getOrDefault(PrearcUtils.PARAM_LABEL, null);

        log.debug("Building BLI session for Project: {} Subject: {} Sesssion: {}", project, subject, label);

        // Initialize the session and populate
        PixiBlisessiondataBean bliSession = new PixiBlisessiondataBean();

        bliSession.setProject(project);
        bliSession.setSubjectId(subject);
        bliSession.setLabel(label);

        // Build scans
        Path scanDir = sessionDir.toPath().resolve("SCANS");
        List<Path> scans = Files.list(scanDir).filter(Files::isDirectory).collect(Collectors.toList());

        for (Path scan : scans) {
            final BliScanBuilder bliScanBuilder = new BliScanBuilder(scan);
            bliSession.addScans_scan(bliScanBuilder.call());
        }

        bliSession.setOperator(bliSession.getScans_scan()
                                         .stream()
                                         .map(XnatImagescandataI::getOperator)
                                         .distinct()
                                         .findAny()
                                         .orElse(""));

//        bliSession.setDate(bliSession.getScans_scan()
//                                     .stream()
//                                     .map(XnatImagescandataI::getStartDate)
//                                     .distinct()
//                                     .findAny()
//                                     .orElse(""));

        return bliSession;
    }

    private void parseAnalyzeClickInfo(Path analyzedClickInfoTxt, PixiBlisessiondataBean bliSession) {
        try (Scanner analyzedClickInfoScanner = new Scanner(analyzedClickInfoTxt)) {
            while (analyzedClickInfoScanner.hasNextLine()) {
                String line = analyzedClickInfoScanner.nextLine();
                String[] splitLine = line.split(":");

                if (splitLine.length == 2) {
                    String key = splitLine[0];
                    String value = splitLine[1].trim();

                    if (key.equalsIgnoreCase("user")) {
                        bliSession.setOperator(value);
                        break;
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Unable to find AnalyzedClickInfo.txt which is weird because we just found the file.");
        }
    }
}
