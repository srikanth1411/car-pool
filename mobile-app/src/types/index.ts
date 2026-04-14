export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  phone?: string
  role: UserRole
  canDrive: boolean
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface GroupLocation {
  id: string
  name: string
  lat?: number
  lng?: number
}

export interface Group {
  id: string
  name: string
  description?: string
  inviteCode: string
  isPrivate: boolean
  owner: User
  memberCount: number
  locations: GroupLocation[]
  fields: GroupField[]
  createdAt: string
}

export type GroupFieldType = 'TEXT' | 'EMAIL' | 'PHOTO' | 'FILE' | 'ID_CARD'

export interface GroupField {
  id: string
  label: string
  fieldType: GroupFieldType
  required: boolean
  displayOrder: number
}

export interface MembershipComment {
  id: string
  author: User
  content?: string
  attachmentUrl?: string
  replies: MembershipComment[]
  createdAt: string
}

export interface ApplicationFieldValue {
  fieldId: string
  fieldLabel: string
  fieldType: string
  value?: string
}

export interface Application {
  membershipId: string
  user: User
  fieldValues: ApplicationFieldValue[]
}

export interface Membership {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'BANNED'
  role: 'ADMIN' | 'MEMBER'
  user: User
  groupId?: string
  groupName?: string
  joinedAt?: string
  createdAt: string
}

export interface Ride {
  id: string
  origin: string
  originLat?: number
  originLng?: number
  destination: string
  destinationLat?: number
  destinationLng?: number
  originLocation?: GroupLocation
  intermediateStops?: GroupLocation[]
  destinationLocation?: GroupLocation
  allStops?: GroupLocation[]
  departureTime: string
  totalSeats: number
  availableSeats: number
  notes?: string
  price?: number
  status: 'OPEN' | 'FULL' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED'
  driver: User
  groupId: string
  groupName: string
  createdAt: string
}

export interface RideRequest {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED'
  message?: string
  seatsRequested: number
  rider: User
  rideId: string
  pickupLocation?: GroupLocation
  dropoffLocation?: GroupLocation
  createdAt: string
}

export interface RideMessage {
  id: string
  content: string
  sender: User
  mentions: User[]
  createdAt: string
}

export interface RidePreference {
  id: string
  tag: string
  groupId: string
  groupName: string
  originLocation: GroupLocation
  destinationLocation: GroupLocation
  intermediateStops: GroupLocation[]
  totalSeats: number
  price?: number
  notes?: string
  createdAt: string
}

export type NotificationType =
  | 'JOIN_REQUEST_RECEIVED'
  | 'JOIN_APPROVED'
  | 'JOIN_REJECTED'
  | 'RIDE_POSTED'
  | 'RIDE_REQUEST_RECEIVED'
  | 'RIDE_REQUEST_CONFIRMED'
  | 'RIDE_REQUEST_DECLINED'
  | 'RIDE_CANCELLED'
  | 'RIDE_STARTED'
  | 'CHAT_MESSAGE'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  metadata?: Record<string, string>
  createdAt: string
}

export interface ApiError {
  status: number
  error: string
  message: string
  traceId?: string
  fieldErrors?: Record<string, string>
}
