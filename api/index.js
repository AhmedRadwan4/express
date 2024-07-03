const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const dotenv = require("dotenv").config();

const app = express();
const upload = multer();

const port = process.env.PORT || 3001;
const REGION = process.env.AWS_REGION;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

if (!REGION || !ACCESS_KEY || !SECRET_KEY || !BUCKET_NAME) {
  throw new Error("Missing necessary AWS configuration environment variables.");
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

app.use(cors());
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json());

const generateUniqueFilename = (originalName) => {
  const uniqueSuffix = uuidv4();
  const fileExtension = originalName.split(".").pop();
  return `${uniqueSuffix}.${fileExtension}`;
};

app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const uniqueFileName = generateUniqueFilename(file.originalname);

  const params = {
    Bucket: BUCKET_NAME,
    Key: `${uniqueFileName}`,
    Body: file.buffer,
    ACL: "public-read",
  };

  try {
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);
    if (data.$metadata.httpStatusCode !== 200) {
      throw new Error("Failed to retrieve the URL of the uploaded file.");
    }
    res.send(
      `https://${params.Bucket}.s3.${REGION}.amazonaws.com/${params.Key}`
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).send(`Failed to upload file: ${error.message}`);
  }
});

app.post("/delete", async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).send("Invalid request format.");
  }

  const urlParts = imageUrl.split("/");
  const key = urlParts.slice(3).join("/"); // Extracting the key from the URL

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const command = new DeleteObjectCommand(params);
    const data = await s3Client.send(command);
    if (data.$metadata.httpStatusCode !== 200) {
      throw new Error("Failed to delete file.");
    }
    res.send(`Deleted file successfully.`);
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).send(`Failed to delete file: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;
