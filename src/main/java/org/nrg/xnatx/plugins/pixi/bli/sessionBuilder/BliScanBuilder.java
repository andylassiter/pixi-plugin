package org.nrg.xnatx.plugins.pixi.bli.sessionBuilder;

import lombok.extern.slf4j.Slf4j;
import org.nrg.xdat.bean.*;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

@Slf4j
public class BliScanBuilder implements Callable<XnatImagescandataBean> {

    private final Path scanDir;
    private final PixiBliscandataBean bliScan;

    public BliScanBuilder(final Path scanDir) {
        this.scanDir = scanDir;
        this.bliScan = new PixiBliscandataBean();
    }

    @Override
    public XnatImagescandataBean call() throws IOException {
        log.debug("Building BLI scans for {}", scanDir);

        String id = scanDir.getFileName().toString();

        bliScan.setId(id);
        bliScan.setType("BLI");

        parseAnalyzedClickInfo();

        File resourceCatalogXml = new File(scanDir.toFile(), "scan_catalog.xml");
        XnatResourcecatalogBean resourceCatalog = new XnatResourcecatalogBean();

        resourceCatalog.setUri(Paths.get("SCANS", id, "scan_catalog.xml").toString());
        resourceCatalog.setLabel("BLI");
        resourceCatalog.setFormat("BLI");
        resourceCatalog.setContent("BLI");
        resourceCatalog.setDescription("BLI Scan data");

        CatCatalogBean catCatalogBean = new CatCatalogBean();

        Files.list(scanDir)
             .map(this::createCatalogEntry)
             .forEach(catCatalogBean::addEntries_entry);

        bliScan.addFile(resourceCatalog);

        try (FileWriter resourceCatalogXmlWriter = new FileWriter(resourceCatalogXml)) {
            catCatalogBean.toXML(resourceCatalogXmlWriter, true);
        } catch (IOException e) {
            log.error("Unable to write scan catalog", e);
        }

        return bliScan;
    }

    private CatEntryBean createCatalogEntry(Path path) {
        CatEntryBean catEntryBean = new CatEntryBean();
        catEntryBean.setUri(String.valueOf(path.getFileName()));
        return catEntryBean;
    }

    private void parseAnalyzedClickInfo() throws IOException {

        List<Path> analyzedClickInfoFiles = Files.list(scanDir).filter(path -> path.endsWith("AnalyzedClickInfo.txt")).collect(Collectors.toList());

        Optional<String> operator = Optional.empty();
        Optional<String> uid = Optional.empty();
        Optional<Date> scanDate = Optional.empty();

        // There should only be one AnalyzedClickInfo.txt per scan
        if (analyzedClickInfoFiles.size() == 1) {
            try (Scanner analyzedClickInfoScanner = new Scanner(analyzedClickInfoFiles.get(0))) {
                while (analyzedClickInfoScanner.hasNextLine()) {
                    String line = analyzedClickInfoScanner.nextLine();
                    String[] splitLine = line.split(":");

                    if (splitLine.length == 2) {
                        String key = splitLine[0];
                        String value = splitLine[1].trim();

                        switch(key.toLowerCase()) {
                            case("clicknumber"): {
                                if (!uid.isPresent()) {
                                    uid = Optional.of(value);
                                }
                                break;
                            }
                            case("user"): {
                                if (!operator.isPresent()) {
                                    operator = Optional.of(value);
                                }
                                break;
                            }
                            case ("*** luminescent image"): {
                                String acqDate = analyzedClickInfoScanner.nextLine();
                                acqDate = acqDate.split(":")[1];
                                acqDate = acqDate.trim();

                                // TODO Acq Time
                                try {
                                    SimpleDateFormat dateFormat = new SimpleDateFormat("EEEE, MMMM dd, yyyy");
                                    scanDate = Optional.of(dateFormat.parse(acqDate));
                                } catch (ParseException e) {
                                    log.warn("Unable to parse scan date.");
                                }

                                break;
                            }
                        }
                    }
                }
            } catch (FileNotFoundException e) {
                log.warn("Unable to find AnalyzedClickInfo.txt which is weird because we just found the file.");
            }
        } else {
            log.error("There should be a single AnalyzedClickInfo.txt file per scan directory.");
        }

        if (!uid.isPresent()) {
            log.info("Unable to find a UID in AnalyzedClickInfo.txt for scan {}. Will generate a random UID instead.", bliScan.getId());
        }

        // TODO Scan date??
        bliScan.setUid(uid.orElse(UUID.randomUUID().toString()));
        bliScan.setOperator(operator.orElse(""));
        bliScan.setStartDate(scanDate.orElse(null));
    }
}
