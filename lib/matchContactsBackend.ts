// Match des contacts via le backend Nest.js
export async function matchContactsViaBackend(userId: string, phoneNumbers: string[]) {
  const API_URL = 'https://prout-backend.onrender.com/friends/match-contacts';
  const API_KEY = '82d6d94d97ad501a596bf866c2831623'; // doit matcher backend .env

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      userId,
      phoneNumbers,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Backend error (match contacts):', res.status, text);
    throw new Error(`Backend error: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log('✅ Contacts matchés avec succès:', result);
  return result;
}


