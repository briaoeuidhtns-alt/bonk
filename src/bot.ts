import {
  ApplicationCommandData,
  Client,
  Intents,
  CommandInteraction,
} from 'discord.js'
import { getClassification, Prediction } from './classifier'
import UserModel from './models/User'
import GuildPost from './models/GuildPost'
import { connect as connectDb } from 'mongoose'
import { DrawLinePredicate, table } from 'table'
import { ethers } from 'hardhat'
import { BonkCoin__factory } from '../typechain'
import imageExtractor from './imageExtractor'
import { pipeAsync } from 'ramda-async'
const HORNLET_PER_DSTN = 10 ** 18

const BONK = '<:bonk:842685478037487626>'

type CommandsSpec = Record<
  string,
  Omit<ApplicationCommandData, 'name'> & {
    handler: (
      interaction: CommandInteraction,
      ...args: Array<any>
    ) => Promise<void>
  }
>

const factory = async () => {
  await connectDb('mongodb://localhost:27017/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'coin',
    useFindAndModify: false,
    useCreateIndex: true,
  })
  console.log('Connected to mongo')

  const [owner] = await ethers.getSigners()

  const bonkCoinFactory = <BonkCoin__factory>(
    await ethers.getContractFactory('BonkCoin', owner)
  )

  if (process.env.CONTRACT_ADDRESS == null)
    throw new Error('Contract address not set')

  const token = bonkCoinFactory.attach(process.env.CONTRACT_ADDRESS)
  console.log('Attached to contract')

  const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
  })

  const commands: CommandsSpec = {
    classify: {
      description: "Get a breakdown of your image's classes",
      options: [
        {
          name: 'input',
          type: 'STRING',
          description: 'The url of the image to classify',
          required: true,
        },
      ],
      handler: async (interaction, ...urls) => {
        // TODO implicit assertion from declared types?
        // dispatcher and code gen thing?
        // if (!(typeof urls === 'string')) throw new Error()
        const classifications = await Promise.all(
          (
            await imageExtractor({
              resources: urls.map((url) => ({ url: new URL(url) })),
            })
          ).map(getClassification)
        )
        const titleEntryLine: DrawLinePredicate = (i, n) =>
          [0, 1, n].includes(i)
        const tableConfig = {
          drawHorizontalLine: titleEntryLine,
          drawVerticalLine: titleEntryLine,
        }
        const formatted = classifications
          .map(
            (c, i) =>
              `**Image ${i}**
\`\`\`
${table(
  [
    ['Class name', 'Probability (%)'],
    ...c.map(({ className, probability }) => [className, probability * 100]),
  ],
  tableConfig
)}
\`\`\`
`
          )
          .join('\n\n')

        interaction.reply(` **Analysis**

${formatted}`)
      },
    },
    'set-address': {
      description: 'Set or update your etherium address',
      options: [
        {
          name: 'address',
          type: 'STRING',
          description: 'Your etherium address',
          required: true,
        },
      ],
      handler: async (interaction, address) => {
        await interaction.reply('Updating address...')
        try {
          const user = await UserModel.findOneAndUpdate(
            { discordId: interaction.user.id },
            { address },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
          await interaction.editReply('Successfully updated address')
          const pendingPayment = user.pendingPayment
          if (pendingPayment >= 1n) {
            await token.mint(user.address!, <any>pendingPayment)
            user.pendingPayment = 0n
            await user.save()
            await interaction.editReply(`Successfully updated address

Sent a pending payment of ${Number(pendingPayment) / HORNLET_PER_DSTN} DSTN`)
          }
        } catch (err: unknown) {
          console.error(err)
          interaction.editReply(`**Error**
\`\`\`js
${err}
\`\`\``)
        }
      },
    },
    'repost-count': {
      description:
        'Get the number of times this image url has been reposted in this server',
      options: [
        {
          name: 'input',
          type: 'STRING',
          description: 'The url of the image to count',
          required: true,
        },
      ],
      handler: async (interaction, imgPath) => {
        if (!interaction.guild) {
          interaction.reply('Not in a guild')
        } else {
          const img = new URL(imgPath)
          await interaction.reply('Fetching repost info...')
          const post = await GuildPost.findOne({
            discordId: interaction.guild.id,
            baseUrl: img.hostname + img.pathname,
          })

          interaction.editReply(
            `I have seen this image ${post?.repostCount ?? 0} time${
              post?.repostCount === 1 ? '' : 's'
            } in this guild`
          )
        }
      },
    },
    balance: {
      description: 'Get your balance',
      handler: async (interaction) => {
        await interaction.reply('Fetching user info...')
        const user = await UserModel.findOne({ discordId: interaction.user.id })
        const pending = Number(user?.pendingPayment ?? 0n) / HORNLET_PER_DSTN

        await interaction.editReply('Fetching wallet balance...')
        const wallet =
          Number(user?.address ? await token.balanceOf(user.address) : 0n) /
          HORNLET_PER_DSTN

        interaction.editReply(`\`\`\`
${table([
  ['', 'DSTN'],
  ['Pending', pending],
  ['In wallet', wallet],
])}
\`\`\``)
      },
    },
  }

  client.once('ready', async () => {
    await Promise.all(
      Object.entries(commands)
        .map(([name, { handler: _, ...command }]) => ({ ...command, name }))
        .map(async (c) => {
          // ts-node thinks client.application could be null
          // but tsc and I don't
          // const cmd = await client.application!.commands.create(c)
          // FIXME global commands take a long time to update
          const cmd = await client.guilds.cache
            .get('325101245243326465')!
            .commands.create(c)
          return cmd
        })
    )
  })

  client.on('interaction', async (interaction) => {
    if (!interaction.isCommand()) return

    const name = interaction.commandName
    const { handler } = (commands.hasOwnProperty(name) && commands[name]) || {}
    await handler?.(interaction, ...interaction.options.map((o) => o.value))
  })

  const pHornypost = (res: Prediction) =>
    res
      .filter(({ className }) => ['Hentai', 'Sexy', 'Porn'].includes(className))
      .map(({ probability: p }) => p)
      .reduce((a, b) => a + b)

  client.on('message', async (msg) => {
    if (msg.author.bot) return

    const imgUrlsWReposts = await imageExtractor(msg)
    const imgUrlsRepostP = await Promise.all(
      imgUrlsWReposts.map(async (img) => {
        if (!msg.guild) return false
        const post = await GuildPost.findOneAndUpdate(
          { discordId: msg.guild.id, baseUrl: img.hostname + img.pathname },
          { $inc: { repostCount: 1 } },
          { upsert: true, setDefaultsOnInsert: true }
        )
        // if null then hadn't been posted before
        return post == null
      })
    )
    const imgUrls = imgUrlsWReposts.filter((_, i) => imgUrlsRepostP[i])

    const p = (await Promise.all(imgUrls.map(getClassification)))
      .map(pHornypost)
      .filter((p) => p > 0.25)
      .reduce((a, b) => a + b, 0)

    if (p) {
      // in hornlet
      const reward = BigInt(Math.floor(p * HORNLET_PER_DSTN))
      await msg.react(BONK)
      const replyBody = `That post just earned you ${
        Number(reward) / HORNLET_PER_DSTN
      } DSTN!`
      const replyP = msg.reply(`${replyBody}

Fetching user info...`)
      const user = (await UserModel.findOneAndUpdate(
        { discordId: msg.author.id },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ))!
      let status: string
      if (user.address) {
        await token.mint(user.address, <any>reward)
        status = 'Transaction completed successfully!'
      } else {
        user.pendingPayment += reward
        await user.save()
        status = `You haven't \`/set-address\` yet. ${
          Number(user.pendingPayment) / HORNLET_PER_DSTN
        } DSTN currently pending.`
      }
      const reply = await replyP
      reply.edit(
        `${replyBody}

${status}`
      )
    }
  })

  await client.login(process.env.DISCORD_TOKEN)
  console.log('Logged in to discord')
}

// XXXXX started here for now
factory()

export default factory
