import Unique from './Unique'

export default interface User extends Unique {
  email: string
  name?: string | null
}

export interface CreateUserPayload {
  userId: string
  email: string
}
