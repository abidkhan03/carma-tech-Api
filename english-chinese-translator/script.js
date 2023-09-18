
// AWS.config.region = 'us-east-2';
// AWS.config.credentials = new AWS.CognitoIdentityCredentials({
//     // Replace with your own Identity Pool ID
//     IdentityPoolId: 'us-east-2:f25ff1ef-89f1-4642-aa38-f76882723c90',
// });

// AWS.config.credentials.get(function (err) {
//     if (err) console.log(err);
//     else console.log('Successfully retreived AWS credentials');
// });

// function callLambdaFunction(inputText) {
//     var lambda = new AWS.Lambda();
//     var params = {
//         // Replace with your own Lambda function name
//         FunctionName: 'LambdaTranslatorChatGPTSt-ChatGPTEngChnTranslatorL-rEplYUbzOL50',
//         Payload: JSON.stringify({ text: inputText })
//     };

//     lambda.invoke(params, function (error, data) {
//         if (error) {
//             console.error(JSON.stringify(error));
//             return;
//         }
//         if (data.Payload) {
//             var response = JSON.parse(data.Payload);
//             if (response.statusCode === 200) {
//                 var translationData = response.body;
//                 document.getElementById("response").value = translationData.output;
//             } else {
//                 console.log("lambda error: ", response.body)
//             }
//         }
//     });

// }

// function clearInput() {
//     document.getElementById('userInput').value = '';
// }



function callLambdaFunction(inputText, config) {
    var lambda = new AWS.Lambda();
    var params = {
        FunctionName: config.lambdaFunctionName,
        Payload: JSON.stringify({ text: inputText })
    };

    lambda.invoke(params, function (error, data) {
        if (error) {
            console.error(JSON.stringify(error));
            return;
        }
        if (data.Payload) {
            var response = JSON.parse(data.Payload);
            if (response.statusCode === 200) {
                var translationData = response.body;
                if (detectLanguage(translationData.output) === 'English') {
                    document.getElementById("responseLabel").textContent = 'English';
                } else {
                    document.getElementById("responseLabel").textContent = 'Chinese';
                }

                document.getElementById("response").value = translationData.output;
            } else {
                console.log("lambda error: ", response.body)
            }
        }
    });
}

fetch('/app-config')
    .then(response => response.json())
    .then(config => {
        // config = fetchedConfig;
        AWS.config.region = 'us-east-2';
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: config.identityPoolId,
        });

        AWS.config.credentials.get(function (err) {
            if (err) console.log(err);
            else console.log('Successfully retrieved AWS credentials');
        });

        document.getElementById('submitBtn').addEventListener('click', function () {
            const inputText = document.getElementById('userInput').value;
            const detectedLanguage = detectLanguage(inputText);

            document.getElementById("userInputLabel").textContent = detectedLanguage;
            document.getElementById("responseLabel").textContent = detectedLanguage === 'English' ? 'Chinese' : 'English';

            if (config) {
                // var inputText = document.getElementById('userInput').value;
                callLambdaFunction(inputText, config);
            } else {
                console.error('Config has not been initialized yet.');
            }
        }
        );

    })
    .catch(error => {
        console.error('Error fetching app config: ', error);
    });


function detectLanguage(inputText) {
    const chinesePattern = /[\u4e00-\u9fa5]/;
    return chinesePattern.test(inputText) ? 'Chinese' : 'English';
}

function clearInput() {
    document.getElementById('userInput').value = '';
    document.getElementById('response').value = '';
    document.getElementById("userInputLabel").textContent = 'User Input';
    document.getElementById("responseLabel").textContent = 'Response';
}


