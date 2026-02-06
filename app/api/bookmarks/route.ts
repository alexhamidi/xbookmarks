import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'data', 'bookmarks.json');
        const data = await readFile(filePath, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch {
        return NextResponse.json({ data: null });
    }
}
