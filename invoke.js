/**
* Simulates a Lambda invokation request on localhost
*/

const handler = require('./index.js').handler

const operation = 'GET_URL'
// const operation = 'GET_PHOTOS'
// const operation = 'DELETE_PHOTO'
const name = '//s3-eu-central-1.amazonaws.com/photogallery-service/photos/upload_man_private2.jpg'

handler({operation, name}, {}, (err, response)=> {
  if (err) {
    return console.error('Lambda error: ', err)
  }
  console.log('Lambda response: ', response)
})