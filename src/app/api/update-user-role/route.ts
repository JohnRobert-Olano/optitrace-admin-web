import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ROLES = new Set(["patient", "doctor", "admin", "master_admin"]);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "master_admin") {
      return NextResponse.json({ error: "Forbidden: Requires master_admin privileges" }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) {
      return NextResponse.json({ error: "Bad Request: Missing required fields" }, { status: 400 });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Bad Request: Invalid role value" }, { status: 400 });
    }

    const targetRef = adminDb.collection("users").doc(userId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return NextResponse.json({ error: "Not Found: User does not exist" }, { status: 404 });
    }

    await targetRef.update({ role });

    return NextResponse.json({ success: true, message: "User role updated successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
