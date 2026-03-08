---
title: On Abstractions
date: 2026-01-20
tags:
  - software-design
  - programming
description: "When to abstract, when not to, and how to tell the difference."
---

Every abstraction is a bet. You're betting that the pattern you see today will hold tomorrow — that the thing you're wrapping will change in predictable ways, that the interface you're defining captures the right set of operations, that future callers will want exactly the flexibility you're providing.

Most of these bets lose.

## The Premature Abstraction

You've seen this code. Everyone has:

```ruby
class BaseRepository
  def find(id)
    raise NotImplementedError
  end

  def save(entity)
    raise NotImplementedError
  end

  def delete(id)
    raise NotImplementedError
  end
end

class UserRepository < BaseRepository
  def find(id)
    User.find(id)
  end

  # ... you get the idea
end
```

There's one repository. There will only ever be one repository. The "base class" exists because someone read a book about design patterns and decided that *someday* there might be a second implementation. There won't be.

This code has negative value. It's harder to read than the direct version. It's harder to change because now you have two files instead of one. And the abstraction boundary it creates — the `BaseRepository` interface — is almost certainly wrong for whatever hypothetical second implementation might eventually need.

## Three Before You Abstract

My rule of thumb: wait until you have three concrete instances of a pattern before you abstract it. Not two — three. Two instances give you a line. Three give you a curve. And the curve is where the actual pattern lives.

With three instances you can see:

- What's actually common versus what looked common after two cases
- Where the variation points are
- Whether the abstraction simplifies or complicates

Two database-backed models that both need caching? Don't build a `CacheableModel` mixin. Wait for the third. When it arrives, you'll discover that the caching logic for the first two was simpler than you thought and the third one needs something completely different.

## The Good Abstraction

Good abstractions share a few properties:

**They compress.** Using the abstraction should require thinking about fewer things than using the underlying implementation directly. If your abstraction leaks as many details as it hides, it's not pulling its weight.

**They compose.** Good abstractions work with other abstractions without requiring knowledge of each other's internals. Unix pipes are the canonical example — each program knows nothing about the others, yet they combine to do things none of them could do alone.

**They're stable.** The interface shouldn't change every time the implementation does. If you find yourself modifying the abstraction boundary every sprint, it's not abstracting the right thing.

## When in Doubt

Write the concrete thing. Copy-paste if you have to. Duplication is far cheaper than the wrong abstraction, because duplication is obvious and the wrong abstraction is not.

The best code I've written has fewer abstractions than I originally planned. The worst code I've written has more.
