import { prop, getModelForClass } from '@typegoose/typegoose'

export class User {
  // TODO for this to be atomic should prob be an array of transactions
  @prop({
    default: 0,
    required: true,
    set: (val: Parameters<typeof BigInt>) => BigInt(val).toString(),
    get: BigInt,
    type: String,
  })
  public pendingPayment!: bigint

  @prop()
  public address?: string

  @prop({ unique: true, required: true })
  public discordId!: string
}

const UserModel = getModelForClass(User)
export default UserModel
