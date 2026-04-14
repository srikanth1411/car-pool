import { apiClient } from './client'
import type { Application, Group, GroupLocation, Membership, MembershipComment } from '../types'

export const groupsApi = {
  create: (data: {
    name: string
    description?: string
    isPrivate?: boolean
    locations?: { name: string; lat?: number; lng?: number }[]
    fields?: { label: string; fieldType: string; required?: boolean; displayOrder?: number }[]
  }) => apiClient.post<Group>('/groups', data).then((r) => r.data),

  getMyGroups: () =>
    apiClient.get<Group[]>('/groups/me').then((r) => r.data),

  getMyPendingRequests: () =>
    apiClient.get<Membership[]>('/groups/me/pending').then((r) => r.data),

  getAdminPendingRequests: () =>
    apiClient.get<Membership[]>('/groups/me/admin-pending').then((r) => r.data),

  getGroupByInviteCode: (inviteCode: string) =>
    apiClient.get<Group>(`/groups/invite/${inviteCode}`).then((r) => r.data),

  getGroup: (groupId: string) =>
    apiClient.get<Group>(`/groups/${groupId}`).then((r) => r.data),

  join: (inviteCode: string, fieldValues?: { fieldId: string; value: string }[]) =>
    apiClient.post<Membership>('/groups/join', { inviteCode, fieldValues: fieldValues ?? [] }).then((r) => r.data),

  getMembers: (groupId: string) =>
    apiClient.get<Membership[]>(`/groups/${groupId}/members`).then((r) => r.data),

  getPendingRequests: (groupId: string) =>
    apiClient.get<Membership[]>(`/groups/${groupId}/requests`).then((r) => r.data),

  approveMember: (groupId: string, userId: string) =>
    apiClient.post<Membership>(`/groups/${groupId}/requests/${userId}/approve`).then((r) => r.data),

  rejectMember: (groupId: string, userId: string) =>
    apiClient.post<Membership>(`/groups/${groupId}/requests/${userId}/reject`).then((r) => r.data),

  getApplication: (groupId: string, userId: string) =>
    apiClient.get<Application>(`/groups/${groupId}/requests/${userId}/application`).then((r) => r.data),

  getComments: (groupId: string, userId: string) =>
    apiClient.get<MembershipComment[]>(`/groups/${groupId}/members/${userId}/comments`).then((r) => r.data),

  addComment: (groupId: string, userId: string, data: { content?: string; attachmentUrl?: string; parentId?: string }) =>
    apiClient.post<MembershipComment>(`/groups/${groupId}/members/${userId}/comments`, data).then((r) => r.data),

  deleteGroup: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}`),

  removeMember: (groupId: string, userId: string) =>
    apiClient.delete(`/groups/${groupId}/members/${userId}`).then((r) => r.data),

  getLocations: (groupId: string) =>
    apiClient.get<GroupLocation[]>(`/groups/${groupId}/locations`).then((r) => r.data),

  addLocation: (groupId: string, data: { name: string; lat?: number; lng?: number }) =>
    apiClient.post<GroupLocation>(`/groups/${groupId}/locations`, data).then((r) => r.data),

  removeLocation: (groupId: string, locationId: string) =>
    apiClient.delete(`/groups/${groupId}/locations/${locationId}`),
}
