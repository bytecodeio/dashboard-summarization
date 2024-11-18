const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = 'additional_context_docs_combined_gen_ai';


// Function to list files in the bucket and create fileParts
async function getFileParts() {
    const [files] = await storage.bucket(bucketName).getFiles();
    if (files.length === 0) {
        return [];
    }
    return files.map(file => ({
        file_data: {
            file_uri: `gs://${bucketName}/${file.name}`,
            mime_type: 'application/pdf' // Update this if your files have different MIME types
            // TODO: Make it pull the bucket files.
        }
    }));
}

module.exports = getFileParts;