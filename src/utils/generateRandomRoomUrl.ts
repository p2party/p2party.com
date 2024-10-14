"use client";

const bytesToAlphanumeric = (bytes: Uint8Array) => {
  const alphanumericChars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let outputString = "";

  for (let i = 0; i < bytes.length; i++) {
    outputString += alphanumericChars[bytes[i] % alphanumericChars.length];
  }

  return outputString;
};

const generateRandomAlphanumeric = async (urlLen: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const randomBytes = new Uint8Array(urlLen);
      window.crypto.getRandomValues(randomBytes);

      const url = bytesToAlphanumeric(randomBytes);

      resolve(url);
    } catch (error) {
      reject(error);
    }
  });
};

export default generateRandomAlphanumeric;
