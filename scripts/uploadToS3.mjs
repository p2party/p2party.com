import { promises as fs, readFileSync } from "fs";
import * as path from "path";
import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getMimeTypeFromExtension } from "./getMimeTypeFromExtension.mjs";

const client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_SECRET_KEY,
  },
});

// Recursive getFiles from
// https://stackoverflow.com/a/45130990/831465
async function getDirFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getDirFiles(res) : res;
    }),
  );

  return Array.prototype.concat(...files);
}

async function getAllObjectsFromS3Bucket() {
  const listcommand = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET,
  });

  const files = [];

  try {
    let isTruncated = true;

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await client.send(listcommand);

      if (!Contents) return [];

      const contentsLen = Contents.length;
      for (let i = 0; i < contentsLen; i++) {
        if (
          (process.env.NODE_ENV === "development" &&
            Contents[i].Key?.includes("robots.txt")) ||
          Contents[i].Key?.includes(".well-known") ||
          Contents[i].Key?.includes(
            "apple-developer-merchantid-domain-association",
          )
        )
          continue;

        files.push({ Key: Contents[i].Key });
      }
      isTruncated = IsTruncated;
      listcommand.input.ContinuationToken = NextContinuationToken;
    }

    return files;
  } catch (err) {
    console.error(err);
  }
}

const existingFiles = await getAllObjectsFromS3Bucket();

const buildDir = "build";

const dirfiles = await getDirFiles(buildDir);
const files = dirfiles.reduce((result, file) => {
  const noRobots =
    process.env.NODE_ENV !== "development" || !file.includes("robots.txt");

  if (!file.includes(".DS_Store") && noRobots) {
    result.push(path.relative(buildDir, file));
  }

  return result;
}, []);
const filesLen = files.length;

const uploadedFiles = existingFiles.map((file) => {
  return file.Key;
});
const uploadedFilesLen = uploadedFiles.length;

// // If we want to clean up
// for (let i = 0; i < uploadedFilesLen; i++) {
//   if (files.indexOf(existingFiles[i].Key) === -1) {
//     console.log(existingFiles[i].Key);
//
//     const command = new DeleteObjectCommand({
//       Bucket: process.env.AWS_S3_BUCKET,
//       Delete: {
//         Objects: existingFiles[i],
//       },
//     });
//
//     try {
//       const { Deleted } = await client.send(command);
//       console.log(
//         `Successfully deleted ${Deleted.length} objects from S3 bucket.`,
//       );
//     } catch (err) {
//       console.error(err);
//     }
//   }
// }

for (let i = 0; i < filesLen; i++) {
  // if (files[i].includes(".DS_Store")) continue;
  //
  // if (process.env.NODE_ENV === "development" && files[i].includes("robots.txt"))
  //   continue;

  if (uploadedFiles.indexOf(files[i]) === -1) {
    const putcommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: files[i],
      Body: readFileSync(path.resolve(buildDir, files[i]), "utf8"),
      ContentType: getMimeTypeFromExtension(
        path.extname(files[i]).replace(".", ""),
      ),
    });

    try {
      await client.send(putcommand);
    } catch (err) {
      console.error(err);
    }

    if (uploadedFilesLen < filesLen) {
      const filesToChange = [
        "index.html",
        "index.txt",
        "sitemap.xml",
        "en/index.html",
        "en/index.txt",
        "el-GR/index.html",
        "el-GR/index.txt",
      ];
      for (let i = 0; i < filesToChange.length; i++) {
        const deletecommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: filesToChange[i],
        });

        try {
          const res = await client.send(deletecommand);
          console.log(`Successfully deleted ${res} object from S3 bucket.`);
        } catch (err) {
          console.error(err);
        }

        const newputcommand = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: filesToChange[i],
          Body: readFileSync(path.resolve(buildDir, filesToChange[i]), "utf8"),
          ContentType: getMimeTypeFromExtension(
            path.extname(filesToChange[i]).replace(".", ""),
          ),
        });

        try {
          await client.send(newputcommand);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }
}

console.log("Successfully uploaded website");
