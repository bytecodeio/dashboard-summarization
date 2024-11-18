
const writeStructuredLog = (message) => {
    // Complete a structured log entry.
    return {
        severity: 'INFO',
        message: message,
        // Log viewer accesses 'component' as 'jsonPayload.component'.
        component: 'dashboard-summarization-logs',
    }
}
module.exports = writeStructuredLog