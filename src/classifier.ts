import got from 'got'
import * as tf from '@tensorflow/tfjs-node-gpu'
import * as nsfw from 'nsfwjs'
import sharp from 'sharp'

export type Prediction = Array<nsfw.predictionType>

const modelP = nsfw.load(`file://${process.env.PWD}/model/`, <any>{
  type: 'graph',
})

export const getClassification = async (
  url: URL | string
): Promise<Prediction> => {
  const pic = await sharp(await got(url).buffer())
    .png()
    .toBuffer()
  const model = await modelP
  let image: tf.Tensor3D | undefined
  try {
    image = <tf.Tensor3D>tf.node.decodeImage(pic, 3)
    const predictions = await model.classify(image)
    return predictions
  } finally {
    image?.dispose()
  }
}
