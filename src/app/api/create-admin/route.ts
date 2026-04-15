import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    
    // Check if caller is master_admin
    const callerDoc = await adminDb.collection('users').doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'master_admin') {
      return NextResponse.json({ error: 'Forbidden: Requires master_admin privileges' }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Bad Request: Missing required fields' }, { status: 400 });
    }

    // Create the standard Firebase Auth account
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    const createdAt = new Date().toISOString();

    // Create the Firestore document
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      role: 'admin',
      createdAt,
    });

    return NextResponse.json({ success: true, message: 'Admin created successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
