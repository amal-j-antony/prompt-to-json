import { ObjectId } from 'mongodb'
import {
  briefKey,
  DEFAULT_SETTINGS,
  historyTitle,
  parseSettings,
  type BriefSettings,
  type FieldDocs,
} from '../shared/brief-docs'
import type { HistoryEntryDto, SaveResultDto } from '../shared/api'
import type { BriefDoc, Collections } from './db'

export function toHistoryEntry(brief: BriefDoc): HistoryEntryDto {
  return {
    id: brief._id.toHexString(),
    savedAt: brief.savedAt,
    docs: brief.docs,
    settings: parseSettings(brief.settings) ?? DEFAULT_SETTINGS,
  }
}

export async function listBriefs(collections: Collections, userId: ObjectId): Promise<HistoryEntryDto[]> {
  const briefs = await collections.briefs.find({ userId }).sort({ savedAt: -1 }).limit(50).toArray()
  return briefs.map(toHistoryEntry)
}

export async function saveBrief(
  collections: Collections,
  userId: ObjectId,
  docs: FieldDocs,
  settings: BriefSettings,
): Promise<SaveResultDto> {
  const newest = await collections.briefs.findOne({ userId }, { sort: { savedAt: -1 } })
  if (newest && briefKey(newest.docs, toHistoryEntry(newest).settings) === briefKey(docs, settings)) {
    return { entry: toHistoryEntry(newest), duplicate: true }
  }

  const savedAt = Date.now()
  const brief: BriefDoc = {
    _id: new ObjectId(),
    userId,
    title: historyTitle(docs),
    savedAt,
    docs,
    settings,
    createdAt: new Date(savedAt),
  }
  await collections.briefs.insertOne(brief)
  await trimBriefs(collections, userId)
  return { entry: toHistoryEntry(brief), duplicate: false }
}

async function trimBriefs(collections: Collections, userId: ObjectId): Promise<void> {
  const stale = await collections.briefs
    .find({ userId }, { projection: { _id: 1 } })
    .sort({ savedAt: -1 })
    .skip(50)
    .toArray()

  if (stale.length === 0) return
  await collections.briefs.deleteMany({ userId, _id: { $in: stale.map((brief) => brief._id) } })
}

export async function deleteBrief(collections: Collections, userId: ObjectId, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const result = await collections.briefs.deleteOne({ _id: new ObjectId(id), userId })
  return result.deletedCount === 1
}

export async function clearBriefs(collections: Collections, userId: ObjectId): Promise<void> {
  await collections.briefs.deleteMany({ userId })
}
