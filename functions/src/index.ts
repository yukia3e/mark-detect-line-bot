import * as functions from 'firebase-functions';
import * as request from 'request';
import * as crypto from "crypto";
import * as PREDICTION_API from "@azure/cognitiveservices-customvision-prediction";

const REGION = 'asia-northeast1'
const CONTENT_URL_PREFIX = "https://api.line.me/v2/bot/message/";
const CONTENT_URL_SUFFIX = "/content";

// TODO: Set your token and secret
const ACCESS_TOKEN_LINE_CHANNEL = "";
const SECRET_LINE_CHANNEL = "";
const COGNITIVE_PREDICTION_KEY = "";
const COGNITIVE_PROJECT_ID = "";
const COGNITIVE_PUBLISH_ID = "";

function validateSignature(signature: any, body: any) {
    const LINE_CHANNEL_SECRET = SECRET_LINE_CHANNEL;
    return signature === crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(Buffer.from(JSON.stringify(body))).digest('base64');
}

async function postCognitive(event: any) {
    const contentUrl = CONTENT_URL_PREFIX + event.message.id + CONTENT_URL_SUFFIX;
    console.log("contentUrl => " + contentUrl);

    const body = await getImage(contentUrl).catch(errorMsg => {
        console.log(errorMsg);
        return
    });
    console.log('got Image !');

    const msg: string | void = await callComputerVisionAPI(body).catch(errorMsg => {
        console.log(errorMsg);
        return
    });

    if (msg === undefined) {
        throw new Error('callComputerVisionAPI\'s msg is empty...')
    }

    console.log('Post Cognitive !');
    await postLineMessage(event, msg)
}

function getImage(contentUrl: string) {
    return new Promise((resolve, reject) => {
        console.log('getImage start');
        
        const getContentOption = {
            url: contentUrl,
            method: "GET",
            headers: {
                Authorization: "Bearer {" + ACCESS_TOKEN_LINE_CHANNEL + "}",
            },
            encoding: null,
        };

        request(getContentOption, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                resolve(body);
            } else {
                reject('画像取得でエラーが発生しました。');
            }
        });
    });
}

async function callComputerVisionAPI(body: any) {
    const predictor = new PREDICTION_API.PredictionAPIClient(
        COGNITIVE_PREDICTION_KEY,
        "https://japaneast.api.cognitive.microsoft.com/"
    );
    const results = await predictor.detectImage(
        COGNITIVE_PROJECT_ID,
        COGNITIVE_PUBLISH_ID,
        body
    );

    if (results.predictions === undefined) {
        throw new Error('prediction is empty')
    }

    if (results.predictions.length > 0) {
        results.predictions.sort((a, b) => {
            return a.probability! < b.probability! ? 1 : -1
        })
    }

    // Show results
    console.log("Results:");
    if (results.predictions !== undefined) {
        results.predictions.forEach(predictedResult => {
            if (predictedResult.probability !== undefined && predictedResult.boundingBox !== undefined) {
                console.log(`\t ${predictedResult.tagName}: ${(predictedResult.probability * 100.0).toFixed(2)}% ${predictedResult.boundingBox.left},${predictedResult.boundingBox.top},${predictedResult.boundingBox.width},${predictedResult.boundingBox.height}`);
            }
        });
    }

    if (
        results.predictions.length > 0
        && (results.predictions[0].probability !== undefined && results.predictions[0].probability > 0.5)
    ) {
        return 'Thanks!\nスペシャルURLはこちら！';
    } else {
        return 'マークが見つかりませんでした。マークがはっきり映るようにお試しください！';
    }
}

function postLineMessage(event: any, msg: string) {
    return new Promise((resolve, reject) => {
        const jObj = {
            type: "text",
            id: event.message.id,
            text: msg,
        };
        console.log("jObj => " + jObj.text);

        const postOptions = {
            url: "https://api.line.me/v2/bot/message/reply",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer {" + ACCESS_TOKEN_LINE_CHANNEL + "}",
            },
            json: {
                replyToken: event.replyToken,
                messages: [jObj],
            },
        };

        request(postOptions, (error: any, res: any, body: any) => {
            if (!error && res.statusCode === 200) {
            console.log("Post LINE Message !");
            resolve();
            } else {
            console.log(res);
            reject("LINEへの通知でエラーが発生しました。");
            }
        });
        });
}

async function postMessage(event: any, res: any) {
    console.log(event);

    const messageType = event.message.type;
    console.log("messageType => " + messageType);

    if (messageType === 'image') {
        const contentProvider = event.message.contentProvider.type;
        console.log("contentProvider => " + contentProvider)
        if (contentProvider === 'line') {
            console.log("exec postCognitive");
            await postCognitive(event).catch(() => {
                res.status(500).end();
            });
        } else {
            await postLineMessage(event, 'LIFFからの画像は受け付けておりません！').catch(() => {
                res.status(500).end();
            });
        }
    } else {
        await postLineMessage(event, 'スペシャルサイトのURLをGETするためには、画像を投稿してください！').catch(() => {
            res.status(500).end();
        });;
    }
    res.status(200).end
}

export const markDetectLineBot = functions.region(REGION).https.onRequest(async (req, res) => {
    console.log('Triggered');
    if (validateSignature(req.headers['x-line-signature'], req.body)) {
        for (const event of req.body.events) {
            postMessage(event, res).catch();
        };
        res.status(200).end();
    } else {
        console.log('fail to validate signature');
        res.status(400).end();
    }
})
