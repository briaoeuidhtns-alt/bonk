import { Message } from 'discord.js'
import execa from 'execa'
import mime from 'mime-types'
import { prop, map, partition } from 'ramda'
import { pipeAsync } from 'ramda-async'

interface Resource {
  url: URL
  contentType?: string
  repost?: boolean
}

interface State {
  message?: Message
  resources: Array<Resource>
}

type ChainFn = ({ message, resources }: State) => State | Promise<State>

const bodyExtractor: ChainFn = ({ message, resources, ...rest }) => {
  const urlRegex =
    /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi

  return {
    message,
    ...rest,
    resources: [
      ...resources,
      ...(message?.content.match(urlRegex) ?? []).map((url) => ({
        url: new URL(url),
      })),
    ],
  }
}

const attachmentExtractor: ChainFn = ({ message, resources, ...rest }) => ({
  message,
  ...rest,
  resources: [
    ...resources,
    ...(message?.attachments.map(({ contentType, proxyURL }) => ({
      contentType: contentType || undefined,
      url: new URL(proxyURL),
    })) ?? []),
  ],
})

const mimeGuesser: ChainFn = ({ resources, ...rest }) => ({
  ...rest,
  resources: resources.map((res) =>
    res.contentType
      ? res
      : { ...res, contentType: mime.lookup(res.url.pathname) || undefined }
  ),
})

export const youtubeDl: ChainFn = async ({ resources, ...rest }) => {
  const [resolved, unresolved] = partition((x) => !!x.contentType, resources)
  const dlResolved = await Promise.all(
    unresolved
      .filter((x) => !x.contentType)
      .map(async (res) => {
        const { url } = res
        try {
          const { stdout } = await execa('youtube-dl', [
            '--get-thumbnail',
            url.toString(),
          ])
          return { url: new URL(stdout), contentType: 'image/probably' }
        } catch (e) {
          console.error(e)
          // forward for later just in case
          return res
        }
      })
  )

  return {
    ...rest,
    resources: [...resolved, ...dlResolved],
  }
}

const mimeFilter: ChainFn = ({ resources, ...rest }) => ({
  ...rest,
  resources: resources.filter(
    // sharp should throw if it's not a supported format
    ({ contentType }) => contentType?.startsWith('image/')
  ),
})

const imageExtractor = pipeAsync(
  (msgOrState: Message | State) =>
    msgOrState instanceof Message
      ? { message: msgOrState, resources: [] }
      : msgOrState,
  bodyExtractor,
  attachmentExtractor,
  mimeGuesser,
  youtubeDl,
  mimeFilter,
  prop('resources'),
  map(prop('url'))
)

export default imageExtractor
