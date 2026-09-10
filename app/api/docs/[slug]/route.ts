import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const DOCS_DIR = join(process.cwd(), 'public', 'docs')

const ALLOWED_FILES = [
  'architecture.md',
  'tools.md',
  'security.md',
  'api.md',
  'deployment.md',
  'contributing.md',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const filename = `${slug}.md`

    if (!ALLOWED_FILES.includes(filename)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const filePath = join(DOCS_DIR, filename)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const content = await readFile(filePath, 'utf-8')

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error reading document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
