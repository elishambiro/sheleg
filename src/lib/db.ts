import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'sheleg-legal'
const DB_VERSION = 1

interface ShelagDB {
  files: {
    key: string
    value: ArrayBuffer
  }
  projects: {
    key: string
    value: string // JSON stringified Project
  }
}

let db: IDBPDatabase<ShelagDB> | null = null

async function getDB(): Promise<IDBPDatabase<ShelagDB>> {
  if (db) return db
  db = await openDB<ShelagDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('files')) {
        database.createObjectStore('files')
      }
      if (!database.objectStoreNames.contains('projects')) {
        database.createObjectStore('projects')
      }
    },
  })
  return db
}

export async function saveFileData(key: string, data: ArrayBuffer): Promise<void> {
  const d = await getDB()
  await d.put('files', data, key)
}

export async function loadFileData(key: string): Promise<ArrayBuffer | undefined> {
  const d = await getDB()
  return d.get('files', key)
}

export async function deleteFileData(key: string): Promise<void> {
  const d = await getDB()
  await d.delete('files', key)
}

export async function saveProject(id: string, json: string): Promise<void> {
  const d = await getDB()
  await d.put('projects', json, id)
}

export async function loadProject(id: string): Promise<string | undefined> {
  const d = await getDB()
  return d.get('projects', id)
}

export async function deleteProject(id: string): Promise<void> {
  const d = await getDB()
  await d.delete('projects', id)
}

export async function listProjectIds(): Promise<string[]> {
  const d = await getDB()
  return (await d.getAllKeys('projects')).map(String)
}
