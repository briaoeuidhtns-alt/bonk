import got from 'got'
import * as tf from '@tensorflow/tfjs-node-gpu'
import * as nsfw from 'nsfwjs'

export type Prediction = Array<nsfw.predictionType>

export const getClassification = async (url: string): Promise<Prediction> => {
  const pic = await got(url).buffer()
  const model = await nsfw.load(`file://${process.env.PWD}/model/`, <any>{
    type: 'graph',
  })
  const image = <tf.Tensor3D>tf.node.decodeImage(pic, 3)
  const predictions = await model.classify(image)
  image.dispose()
  return predictions
}

const urlRegex =
  /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi

export const extractUrls = (s: string) => s.match(urlRegex) ?? []

/*
Promise.all(
  extractUrls(
    'https://cdn.discordapp.com/attachments/325101245243326465/840825903168487454/unknown.png'
  ).map(getClassification)
)
  .then(console.log.bind(console))
  .catch(console.error.bind(console))
*/
