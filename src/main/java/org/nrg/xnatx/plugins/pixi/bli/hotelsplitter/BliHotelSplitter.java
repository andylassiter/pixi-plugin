package org.nrg.xnatx.plugins.pixi.bli.hotelsplitter;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;
import java.awt.image.WritableRaster;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class BliHotelSplitter {

    public static void main(String[] args) throws IOException {
        BufferedImage photographicImage = ImageIO.read(new File("/Users/andylassiter/Desktop/DG20220105114235/photograph.TIF"));
        BufferedImage image = ImageIO.read(new File("/Users/andylassiter/Desktop/DG20220105114235/photograph.TIF"));
        BufferedImage readBiasImage = ImageIO.read(new File("/Users/andylassiter/Desktop/DG20220105114235/readbias.TIF"));
        BufferedImage luminescentImage = ImageIO.read(new File("/Users/andylassiter/Desktop/DG20220105114235/luminescent.TIF"));
        BufferedImage backgroundImage = ImageIO.read(new File("/Users/andylassiter/Desktop/DG20220105114235/background.TIF"));



        int x_start_1 = 30;
        int x_stop_1  = 210;
        int x_start_2 = 210;
        int x_stop_2  = 380;
        int x_start_3 = 380;
        int x_stop_3  = 550;
        int x_start_4 = 550;
        int x_stop_4  = 715; // Odd numbers for resizing
        int x_start_5 = 715;
        int x_stop_5  = 900;

        int y_start = 90;
        int y_stop = 630;
        int height = y_stop - y_start;


        Map<String, Rectangle> rectangles = new HashMap();
        rectangles.put("M01", new Rectangle(x_start_1, y_start,x_stop_1 - x_start_1, height));
        rectangles.put("M02", new Rectangle(x_start_2, y_start,x_stop_2 - x_start_2, height));
        rectangles.put("M03", new Rectangle(x_start_3, y_start,x_stop_3 - x_start_3, height));
        rectangles.put("M04", new Rectangle(x_start_4, y_start,x_stop_4 - x_start_4, height));
        rectangles.put("M05", new Rectangle(x_start_5, y_start,x_stop_5 - x_start_5, height));

        Map<String, BufferedImage> splitImages = rectangles.entrySet()
                                                           .stream()
                                                           .collect(Collectors.toMap(Map.Entry::getKey,
                                                                                     entry -> cropToSubject(image, entry.getValue())));

        splitImages.forEach((subjectId, subjectImage) -> {
            String fileName = String.format("/Users/andylassiter/Desktop/DG20220105114235/photograph-%s.TIF", subjectId);
            File file = new File(fileName);
            try {
                save(subjectImage, file);
            } catch (IOException e) {
                e.printStackTrace();
            }
        });
    }

    public static BufferedImage cropToSubject(BufferedImage hotelImage, Rectangle subjectRectangle) {
        ColorModel cm = hotelImage.getColorModel();
        boolean isAlphaPremultiplied = cm.isAlphaPremultiplied();
        WritableRaster raster = hotelImage.copyData(null);
        BufferedImage subjectImage = new BufferedImage(cm, raster, isAlphaPremultiplied, null);

        subjectImage = subjectImage.getSubimage((int) subjectRectangle.getX(),
                                                (int) subjectRectangle.getY(),
                                                (int) subjectRectangle.getWidth(),
                                                (int) subjectRectangle.getHeight());

        return subjectImage;
    }

    public static void save(BufferedImage image, File file) throws IOException {
        ImageIO.write(image, "TIFF", file);
    }

}
