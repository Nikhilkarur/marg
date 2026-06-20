// Trusted contacts store (localStorage). Replaces the single hardcoded SOS
// contact with a managed list. The "primary" contact is mirrored to the legacy
// `marg_sos_contact` key so the existing SOS engine (lib/sos.js) and TripSafety
// keep working unchanged.
const KEY = 'marg_trusted_contacts'
const LEGACY = 'marg_sos_contact'

const uid = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

export function loadContacts() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch {}
  // Migrate a legacy single contact into the new list.
  try {
    const raw = localStorage.getItem(LEGACY)
    if (raw) {
      const c = JSON.parse(raw)
      if (c?.number) return [{ id: uid(), name: c.name || 'Emergency Contact', number: c.number, relation: '', primary: true }]
    }
  } catch {}
  return []
}

export function saveContacts(list) {
  const arr = (list || []).map((c) => ({ ...c, id: c.id || uid() }))
  if (arr.length && !arr.some((c) => c.primary)) arr[0].primary = true
  try {
    localStorage.setItem(KEY, JSON.stringify(arr))
    const primary = arr.find((c) => c.primary) || arr[0]
    if (primary) localStorage.setItem(LEGACY, JSON.stringify({ name: primary.name, number: primary.number }))
  } catch {}
  return arr
}

export function addContact(c) {
  const list = loadContacts()
  const entry = { id: uid(), name: c.name?.trim() || 'Contact', number: c.number, relation: c.relation?.trim() || '', primary: list.length === 0 }
  return saveContacts([...list, entry])
}

export function removeContact(id) {
  return saveContacts(loadContacts().filter((c) => c.id !== id))
}

export function setPrimary(id) {
  return saveContacts(loadContacts().map((c) => ({ ...c, primary: c.id === id })))
}

export function primaryContact() {
  const list = loadContacts()
  return list.find((c) => c.primary) || list[0] || { name: 'Emergency Contact', number: '9876543210' }
}
