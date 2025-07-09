const axios = require('axios');
const crypto = require('crypto');

const PHONEPE_API_BASE = process.env.PHONEPE_API_BASE;
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;

exports.createPhonePePayment = async ({ amount, registrationId, email, phone }) => {
    try {
        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: `REG_${registrationId}_${Date.now()}`,
            merchantUserId: `USER_${registrationId}`,
            amount: amount * 100, // Convert to paise
            redirectUrl: `${process.env.FRONTEND_URL}/registration/payment-status`,
            redirectMode: 'POST',
            callbackUrl: `${process.env.BACKEND_URL}/api/registration/payment-webhook`,
            paymentInstrument: {
                type: 'PAY_PAGE'
            },
            userInfo: {
                email,
                phone
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const checksum = generateChecksum(base64Payload);

        const response = await axios.post(`${PHONEPE_API_BASE}/pay`, {
            request: base64Payload
        }, {
            headers: {
                'X-VERIFY': checksum,
                'Content-Type': 'application/json'
            }
        });

        return {
            paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
            paymentId: response.data.data.merchantTransactionId
        };
    } catch (error) {
        console.error('PhonePe payment creation error:', error);
        throw error;
    }
};

exports.verifyPayment = async (paymentId) => {
    try {
        const checksum = generateChecksum(`/v3/transaction/${MERCHANT_ID}/${paymentId}/status`);

        const response = await axios.get(
            `${PHONEPE_API_BASE}/transaction/${MERCHANT_ID}/${paymentId}/status`,
            {
                headers: {
                    'X-VERIFY': checksum,
                    'X-MERCHANT-ID': MERCHANT_ID
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('PhonePe payment verification error:', error);
        throw error;
    }
};

function generateChecksum(data) {
    const string = `${data}/pg/v1/pay${SALT_KEY}`;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    return `${sha256}###${SALT_INDEX}`;
}