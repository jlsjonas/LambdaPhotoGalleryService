/**
* The main app handler that will be invoked by the AWS Lambda function
* http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
*/
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const sharp = require('sharp')
const gallery = require('./lib/gallery')

// event - holds all the Lambda headers and request info
// context - has information about the Lambda runtime - http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
// callback - optional function to be called after the code execution, i.e. callback(error, stringResponse)
function handler (event, context, callback){
  console.log('Lambda params:', JSON.stringify(event))
  
  // This handler will both catch APIGateway and CLI invokations
  // the passed in httpMethod will make the distinction between the two of them
  if (event.httpMethod) {
    // It's an APIGateway event
    
    // Imediatelly respond to an OPTIONS call with an empty response body
    // for browser HTTP cross-domain ajax calls
    if (event.httpMethod === 'OPTIONS') {
      return respondToLambdaRoute(callback, {}, null, context)
    }

    // Defining our request API route by method and path
    const route = `${event.httpMethod}_${event.resource}`
    
    switch (route) {
      case 'GET_/v1/url/{name}':
        if (!event.pathParameters.name) {
          throw new Error('Please specify a valid photo name.')
        }
        gallery.getUrl(event.pathParameters.name)
          .then((url)=> {
            console.log('The URL is', url);
            respondToLambdaRoute(callback, {url}, null, context)
          })
          .catch((err)=>{
            console.log(err)
            respondToLambdaRoute(callback,null, err, context)
          })
        break
      case 'GET_/v1/photos':
        gallery.getPhotos()
        .then((photos)=> {
          respondToLambdaRoute(callback, photos, null, context)
        })
        break
      case 'DELETE_/v1/photos/{name}':
        if (!event.pathParameters.name) {
          throw new Error('Please specify a valid photo name.')
        }
        gallery.deletePhoto(event.pathParameters.name)
        .then((response)=> {
          respondToLambdaRoute(callback, response, null, context)
        })
        break
      default:
        respondToLambdaRoute(callback, null, `Unknown route '${route}'.`, context)
    }

  } else if(event.Records){
    //TODO separate into separate lambda for performance purposes (sharp is heavy)
    event.Records.forEach(({eventName, eventSource, s3:{object:{key},bucket:{name:Bucket}}})=>{
      if(eventName === "ObjectCreated:Put" && eventSource === "aws:s3")
        resizeS3Object(Bucket,key)
          // .then(()=>console.log(`succesfully resized ${key} in ${Bucket}`))
          // .catch((err)=>console.log(`Error resizing ${key} in ${Bucket}`,err))
    })

    // new Promise(function(resolve, reject) {
    //   s3.upload(params, function(err, data) {
    //     if (err) {
    //       reject(err);
    //     } else {
    //       resolve(data);
    //     }
    //   });
    // });

  } else {
    // It might be a Lambda direct invocation

    try {
      
      // Direct Lambda invokations, from CLI or through the AWS-SDK API, will have to pass an extra param called 'operation'
      switch (event.operation) {
        case 'GET_URL':
          gallery.getUrl(event.name)
          .then((url)=> {
            respondToLambdaOperation(callback, url)
          })
            .catch((err)=>{
              console.log(err)
              respondToLambdaOperation(context.succeed,null, err)
            })
          break
        case 'GET_PHOTOS':
          gallery.getPhotos()
          .then((photos)=> {
            respondToLambdaOperation(callback, photos)
          })
          break
        case 'DELETE_PHOTO':
          if (!event.name) {
            throw new Error('Please specify a valid photo name.')
          }
          gallery.deletePhoto(event.name)
          .then((response)=> {
            respondToLambdaOperation(callback, response)
          })
          break
        default:
          respondToLambdaOperation(callback, null, `Unknown operation '${event.operation}'.`)
      }
    
    } catch (e) {
      // Catch any unhandled app error and pass it to the Lambda response
      respondToLambdaOperation(callback, null, e)
    }

  }
}

/**
 * Resize an s3 object in a streaming manner, returns a promise
 * @param Bucket
 * @param Key
 * @param size defaults to 300
 * @returns {Promise<S3.Types.PutObjectOutput>}
 */
function resizeS3Object(Bucket,Key, size = 300) {
  const Body = s3.getObject({Bucket, Key}).createReadStream().pipe(sharp().resize(size))
  s3.upload({Bucket, Key, Body}, function(err, data) {
    console.log(err, data);
  })
  // return s3.putObject({Bucket, Key, Body}).promise()
}

// Handle the Lambda operation response, convert the result to string
// function respondToLambdaOperation(callback, response, error){
function respondToLambdaOperation(callback, response, err){
  try {
    response = JSON.stringify(response)
  } catch (e) {
    if(err) response = `${err}`
    response = `${response}`
  }
  // if(context)
  //   context.succeed(response)
  // else
    callback(err, response)
}

// Handle the Lambda API Gateway response, convert the result to string
function respondToLambdaRoute(callback, response, error, context){
  const statusCode = error ? 500 : 200
  if (error) {
    response = typeof error === Error ? error.message : error
  } else {
    try {
      response = JSON.stringify(response)
    } catch (e) {
      response = `${response}`
    }
  }
  // Add cross-origin headers to the response to support browser ajax requests
  const apiGatewayResponse = {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json'
    },
    body: response
  }
  if(context) {
    console.log("using context")
    context.succeed(apiGatewayResponse)
  } else
  callback(null, apiGatewayResponse)
}


module.exports = {handler}