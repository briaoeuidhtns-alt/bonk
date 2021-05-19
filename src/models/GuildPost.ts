import { prop, getModelForClass } from '@typegoose/typegoose'

export class GuildPost {
  @prop({ required: true, index: true })
  public discordId!: string

  @prop({ required: true, index: true })
  public baseUrl!: string

  @prop({ required: true, default: 1 })
  public repostCount!: number
}

const GuildPostModel = getModelForClass(GuildPost)
export default GuildPostModel
