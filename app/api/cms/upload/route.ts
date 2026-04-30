import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import sharp from "sharp";
import { getSessionInfo } from "@/lib/auth/session";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Compression settings
const COMPRESSION_SETTINGS = {
  image: {
    quality: 80,
    maxWidth: 1920,
    maxHeight: 1080
  },
  thumbnail: {
    quality: 60,
    width: 400,
    height: 300
  }
};

export async function POST(request: Request) {
  try {
    // Verify admin access
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo?.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const publicDir = join(process.cwd(), "public", "uploads");
    
    // Ensure uploads directory exists
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }

    let finalPath: string;
    let fileUrl: string;

    // Process based on file type
    if (file.type.startsWith("image/")) {
      // Compress image using sharp
      const compressedBuffer = await sharp(buffer)
        .resize(COMPRESSION_SETTINGS.image.maxWidth, COMPRESSION_SETTINGS.image.maxHeight, {
          fit: "inside",
          withoutEnlargement: true
        })
        .jpeg({ quality: COMPRESSION_SETTINGS.image.quality, progressive: true })
        .toBuffer();

      // Save compressed image
      finalPath = join(publicDir, fileName.replace(/\.[^.]+$/, ".jpg"));
      await writeFile(finalPath, compressedBuffer);
      
      fileUrl = `/uploads/${fileName.replace(/\.[^.]+$/, ".jpg")}`;

      // Also create a thumbnail version
      const thumbBuffer = await sharp(buffer)
        .resize(COMPRESSION_SETTINGS.thumbnail.width, COMPRESSION_SETTINGS.thumbnail.height, {
          fit: "cover"
        })
        .jpeg({ quality: COMPRESSION_SETTINGS.thumbnail.quality, progressive: true })
        .toBuffer();

      const thumbPath = join(publicDir, `thumb-${fileName.replace(/\.[^.]+$/, ".jpg")}`);
      await writeFile(thumbPath, thumbBuffer);
    } else if (file.type.startsWith("video/")) {
      // For videos, just save as-is (client-side compression recommended)
      finalPath = join(publicDir, fileName);
      await writeFile(finalPath, buffer);
      fileUrl = `/uploads/${fileName}`;
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Only images and videos are allowed." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      originalSize: file.size,
      compressed: file.type.startsWith("image/")
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
