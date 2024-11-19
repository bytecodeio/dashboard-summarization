const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const datasetId = 'llm_logs';
const tableId = 'llm_calls';

async function writeToTable(promptText, attachmentSize, output, processName, examplesUsed = []) {
    //   take an md5cum of the input and output to create a unique hash
    const hash = require('crypto').createHash('md5').update
        (promptText + output).digest('hex');
    const rating = null;


    const timestamp = new Date().toISOString();
    const inputBytes = Buffer.byteLength(promptText, 'utf8');
    const outputBytes = Buffer.byteLength(output, 'utf8');

    const rows = [
        {
            hash,
            processName,
            input: promptText,
            attachment_size: attachmentSize,
            output,
            timestamp,
            input_bytes: inputBytes,
            output_bytes: outputBytes,
            rating,
            examples_used: examplesUsed ? examplesUsed.join(',') : null
        }
    ];

    await bigquery.dataset(datasetId).table(tableId).insert(rows);
    console.log(`Inserted ${rows.length} row(s)`);
    return hash;
}

async function writeToTableWithRating(hash, rating) {
    // convert rating to integer
    rating = parseInt(rating);
    const query = `
        UPDATE \`llm_logs.llm_calls\`
        SET rating = @rating
        WHERE \`hash\` = @hash
    `;

    const options = {
        query: query,
        params: { hash: hash, rating: rating }
    };

    await bigquery.query(options);
    console.log(`Updated rating for hash: ${hash} to ${rating}`);   
}

module.exports = { writeToTable, writeToTableWithRating };