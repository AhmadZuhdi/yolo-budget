import { db } from '../db/indexeddb'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore'

let app: any
let firestore: any

export function initFirebase(config: any) {
  app = initializeApp(config)
  firestore = getFirestore(app)
}

export async function pushChanges() {
  // simple example: drain syncQueue and push to firestore
  const items = await db.getAll('syncQueue')
  for (const it of items) {
    try {
      await addDoc(collection(firestore, it.collection), it.payload)
      await db.delete('syncQueue', it.id)
    } catch (e) {
      console.error('push error', e)
    }
  }
}

export async function pullChanges() {
  // example: pull latest from a known collection
  const q = await getDocs(collection(firestore, 'transactions'))
  const items: any[] = []
  q.forEach((d: any) => items.push({ id: d.id, ...d.data() }))
  // merge logic left to developer
  return items
}
