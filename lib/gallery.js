const S3 = require('aws-sdk').S3
const s3Config = require('../config.json').s3
const uuidV4 = require("uuid/v4")
const s3 = new S3({signatureVersion: 'v4'})

const BUCKET_NAME = s3Config.bucketName
const BUCKET_URL = s3Config.bucketUrl
const PHOTOS_PATH = 'photos' // Bucket files path
const IMAGE_URL_PREFIX = `${BUCKET_URL}/${BUCKET_NAME}` // Public URL where the image can be loaded from the browser
const PHOTO_TYPES = /.(jpg|jpeg|png|gif)$/g // Allowed photo upload extensions

// s3.listObjects configs
// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjects-property
const LIST_OBJECTS_PARAMS = {
  Bucket: BUCKET_NAME,
  Prefix: PHOTOS_PATH
}

// s3.deleteObject configs
// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObjects-property
const GET_URL_PARAMS = {
  Bucket: BUCKET_NAME,
  // Key: PHOTOS_PATH + "/" + "uuid",
  Expires: 60
}

// s3.deleteObject configs
// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObjects-property
const DELETE_OBJECTS_PARAMS = {
  Bucket: BUCKET_NAME,
  Key: ''
}

// Retreive photos from S3 filtered by extension
function getUrl(filename){
  return new Promise(function(fulfill, reject) {
    let fileext = filename.substr(filename.lastIndexOf('.'))
    console.log(fileext,PHOTO_TYPES.test(fileext))
    // if(PHOTO_TYPES.test(fileext)) { //bugged for some reason, console_log returned true but ended up in else
      let params = Object.assign({Key:`${PHOTOS_PATH}/${uuidV4()}${fileext}`},GET_URL_PARAMS)
      console.log(params)
      s3.getSignedUrl('putObject', params, function (err, url) {
        if (err) reject(err)
        else {
          fulfill(url)
        }
      })
    // } else
    //   reject("Please enter a valid photo filename")
  })
  //   , function (err, url) {
  //   console.log('The URL is', url);
  // });
}
// Retreive photos from S3 filtered by extension
function getPhotos(){
  return s3.listObjects(LIST_OBJECTS_PARAMS).promise()
  .then((result)=> {
    const files = result.Contents
    .filter((file)=> PHOTO_TYPES.test(file.Key))
    .map((file)=> `${IMAGE_URL_PREFIX}/${file.Key}`)
    return files
  })
}

// Delete a photo by the S3 bucket path
function deletePhoto(filePath){
  const paths = filePath.split('/') // Get the last part of the file path as a phot name
  if (!paths.length) {
    throw new Error(`Photo not found ${filePath}.`)
  }
  const fileToDelete = `${PHOTOS_PATH}/${paths[paths.length-1]}`
  const opParams = Object.assign({}, DELETE_OBJECTS_PARAMS, {
    Key: fileToDelete
  })
  return s3.deleteObject(opParams).promise()
  .then(()=> `Photo '${fileToDelete}' deleted successfully.`)
}

module.exports = {getUrl, getPhotos, deletePhoto}