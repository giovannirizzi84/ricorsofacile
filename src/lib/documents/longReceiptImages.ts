import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jpeg = require("jpeg-js") as {
  decode: (buffer: Buffer, options?: { useTArray?: boolean }) => DecodedImage;
  encode: (image: DecodedImage, quality?: number) => { data: Buffer };
};
const pngjs = require("pngjs") as {
  PNG: {
    sync: {
      read: (buffer: Buffer) => DecodedImage;
      write: (image: DecodedImage) => Buffer;
    };
  };
};

const longReceiptAspectRatio = 2.2;
const maxSegments = 6;
const segmentOverlapRatio = 0.2;
const targetSegmentWidth = 1200;

type DecodedImage = {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
};

export type ImageLayoutType = "STANDARD_IMAGE" | "LONG_RECEIPT_IMAGE";

export type ImageSegmentMetadata = {
  filename: string;
  index: number;
  y: number;
  width: number;
  height: number;
  overlapRatio: number;
};

export type ImagePreprocessingMetadata = {
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  layout: ImageLayoutType;
  segments: ImageSegmentMetadata[];
};

export type PreparedVisionImage = {
  filename: string;
  mimeType: string;
  data: string;
};

export type PreparedImageForVision = {
  visionImages: PreparedVisionImage[];
  metadata: ImagePreprocessingMetadata;
};

export function prepareImageForVision(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): PreparedImageForVision {
  const decoded = decodeImage(buffer, mimeType);

  if (!decoded) {
    return {
      visionImages: [
        {
          filename,
          mimeType,
          data: buffer.toString("base64"),
        },
      ],
      metadata: {
        width: null,
        height: null,
        aspectRatio: null,
        layout: "STANDARD_IMAGE",
        segments: [],
      },
    };
  }

  const aspectRatio = decoded.height / decoded.width;
  const isLongReceiptImage = aspectRatio > longReceiptAspectRatio;
  const segments = isLongReceiptImage
    ? createVerticalSegments(decoded, filename, mimeType)
    : [];
  const centralCrop = isLongReceiptImage
    ? createCentralTextCrop(decoded, filename, mimeType)
    : null;

  return {
    visionImages: [
      {
        filename,
        mimeType,
        data: buffer.toString("base64"),
      },
      ...segments.map((segment) => ({
        filename: segment.filename,
        mimeType: segment.mimeType,
        data: segment.buffer.toString("base64"),
      })),
      ...(centralCrop
        ? [
            {
              filename: centralCrop.filename,
              mimeType: centralCrop.mimeType,
              data: centralCrop.buffer.toString("base64"),
            },
          ]
        : []),
    ],
    metadata: {
      width: decoded.width,
      height: decoded.height,
      aspectRatio: Number(aspectRatio.toFixed(2)),
      layout: isLongReceiptImage ? "LONG_RECEIPT_IMAGE" : "STANDARD_IMAGE",
      segments: segments.map((segment) => ({
        filename: segment.filename,
        index: segment.index,
        y: segment.y,
        width: segment.width,
        height: segment.height,
        overlapRatio: segment.overlapRatio,
      })),
    },
  };
}

function decodeImage(buffer: Buffer, mimeType: string): DecodedImage | null {
  try {
    if (mimeType === "image/jpeg") {
      return jpeg.decode(buffer, { useTArray: true });
    }
    if (mimeType === "image/png") {
      return pngjs.PNG.sync.read(buffer);
    }
  } catch {
    return null;
  }

  return null;
}

function createVerticalSegments(
  image: DecodedImage,
  filename: string,
  mimeType: string,
) {
  const aspectRatio = image.height / image.width;
  const segmentCount = Math.min(
    maxSegments,
    Math.max(4, Math.ceil(aspectRatio * 1.25)),
  );
  const segmentHeight = Math.ceil(image.height / segmentCount);
  const overlap = Math.round(segmentHeight * segmentOverlapRatio);
  const step = Math.max(1, segmentHeight - overlap);
  const scale = Math.max(1, Math.min(4, targetSegmentWidth / image.width));
  const segments: Array<ImageSegmentMetadata & { buffer: Buffer; mimeType: string }> = [];

  for (let index = 1; index <= segmentCount; index += 1) {
    const y = Math.min(image.height - 1, (index - 1) * step);
    const height = Math.min(segmentHeight, image.height - y);
    if (height < image.height * 0.08) break;

    const crop = cropAndScale(image, 0, y, image.width, height, scale);
    const encoded = encodeImage(crop, mimeType);
    segments.push({
      filename: segmentFilename(filename, index, mimeType),
      index,
      y,
      width: image.width,
      height,
      overlapRatio: segmentOverlapRatio,
      buffer: encoded.buffer,
      mimeType: encoded.mimeType,
    });
  }

  return segments;
}

function createCentralTextCrop(
  image: DecodedImage,
  filename: string,
  mimeType: string,
) {
  const cropWidth = Math.max(1, Math.round(image.width * 0.92));
  const x = Math.round((image.width - cropWidth) / 2);
  const scale = Math.max(1, Math.min(4, targetSegmentWidth / cropWidth));
  const crop = cropAndScale(image, x, 0, cropWidth, image.height, scale);
  const encoded = encodeImage(crop, mimeType);

  return {
    filename: centralCropFilename(filename, mimeType),
    buffer: encoded.buffer,
    mimeType: encoded.mimeType,
  };
}

function cropAndScale(
  image: DecodedImage,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
  scale: number,
): DecodedImage {
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);
  const data = Buffer.alloc(targetWidth * targetHeight * 4);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const originalY = sourceY + Math.min(height - 1, Math.floor(targetY / scale));
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const originalX = sourceX + Math.min(width - 1, Math.floor(targetX / scale));
      const sourceIndex = (originalY * image.width + originalX) * 4;
      const targetIndex = (targetY * targetWidth + targetX) * 4;
      data[targetIndex] = image.data[sourceIndex];
      data[targetIndex + 1] = image.data[sourceIndex + 1];
      data[targetIndex + 2] = image.data[sourceIndex + 2];
      data[targetIndex + 3] = image.data[sourceIndex + 3] ?? 255;
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data,
  };
}

function encodeImage(image: DecodedImage, preferredMimeType: string) {
  if (preferredMimeType === "image/png") {
    return {
      mimeType: "image/png",
      buffer: pngjs.PNG.sync.write(image),
    };
  }

  return {
    mimeType: "image/jpeg",
    buffer: jpeg.encode(image, 88).data,
  };
}

function segmentFilename(filename: string, index: number, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const baseName = filename.replace(/\.[^.]+$/, "");
  return `${baseName} - segmento ${index}.${extension}`;
}

function centralCropFilename(filename: string, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const baseName = filename.replace(/\.[^.]+$/, "");
  return `${baseName} - crop centrale.${extension}`;
}
