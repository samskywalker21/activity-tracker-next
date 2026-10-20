// Stand-ins for the Next.js request APIs that server actions use. Each action test file wires them
// up with `vi.mock(..., () => import('../next-mocks'))` so that `jar` is shared with the test.

/** A fake request: cookies Better Auth sets are sent back on the next `headers()`. */
export const jar = new Map<string, string>()

export const nextHeaders = {
  headers: async () =>
    new Headers({ cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') }),
  cookies: async () => ({
    set: (name: string, value: string) => (value ? jar.set(name, value) : jar.delete(name)),
  }),
}

export const nextNavigation = {
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}

export const nextCache = {
  revalidatePath: () => {},
}
