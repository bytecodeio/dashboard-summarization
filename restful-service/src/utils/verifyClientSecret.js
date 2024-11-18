

const storedClientSecret = process.env.GENAI_CLIENT_SECRET

// Middleware to verify client secret
const verifyClientSecret = (req, res, next) => {
    const clientSecret = req.body.client_secret;
    if (clientSecret === storedClientSecret) {
        next();
        console.log('Client secret verified');
    } else {
        res.status(403).send('Forbidden: Invalid client secret');
    }
};
module.exports =  verifyClientSecret;