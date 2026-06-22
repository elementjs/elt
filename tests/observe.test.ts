import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { o } from "../src/observable"
import { $observe, $observe_changes } from "../src/decorators"
import {
  node_append,
  node_remove,
  node_is_observing,
  node_is_connected,
} from "../src/dom"

describe("$observe", () => {
  test("starts observing when appended and stops after node_remove", () => {
    const obs = o(10)
    let count = 0
    const el = document.createElement("div")
    $observe(obs, () => {
      count++
    })(el)

    expect(count).toBe(0)
    expect(node_is_observing(el)).toBe(false)

    node_append(document.body, el)
    expect(count).toBe(1)
    expect(node_is_observing(el)).toBe(true)
    expect(node_is_connected(el)).toBe(true)

    obs.set(20)
    expect(count).toBe(2)

    node_remove(el)
    expect(node_is_observing(el)).toBe(false)
    expect(node_is_connected(el)).toBe(false)

    obs.set(30)
    expect(count).toBe(2)
  })

  test("$observe_changes skips the initial callback until the value changes", () => {
    const obs = o(1)
    let count = 0
    const el = document.createElement("div")
    $observe_changes(obs, () => {
      count++
    })(el)

    node_append(document.body, el)
    expect(count).toBe(0)

    obs.set(2)
    expect(count).toBe(1)

    obs.set(2)
    expect(count).toBe(1)

    node_remove(el)
    obs.set(3)
    expect(count).toBe(1)
  })

  test("passes the decorated node as the third callback argument", () => {
    const obs = o("value")
    let received: Node | null = null
    const el = document.createElement("div")
    $observe(obs, (_, __, node) => {
      received = node
    })(el)

    node_append(document.body, el)
    expect(received).toBe(el)
    node_remove(el)
  })

  test("nested observed descendants stop when an ancestor is removed", () => {
    const obs = o(1)
    let outer = 0
    let inner = 0
    const root = document.createElement("div")
    const child = document.createElement("span")
    node_append(root, child)

    $observe(obs, () => {
      outer++
    })(root)
    $observe(obs, () => {
      inner++
    })(child)

    node_append(document.body, root)
    expect(outer).toBe(1)
    expect(inner).toBe(1)
    expect(node_is_observing(root)).toBe(true)
    expect(node_is_observing(child)).toBe(true)

    node_remove(root)
    expect(node_is_observing(root)).toBe(false)
    expect(node_is_observing(child)).toBe(false)

    obs.set(2)
    expect(outer).toBe(1)
    expect(inner).toBe(1)
  })

  test("moving to a disconnected parent stops observation", () => {
    const obs = o(1)
    let count = 0
    const el = document.createElement("div")
    $observe(obs, () => {
      count++
    })(el)

    node_append(document.body, el)
    expect(count).toBe(1)
    expect(node_is_observing(el)).toBe(true)

    const staging = document.createDocumentFragment()
    node_append(staging, el)
    expect(node_is_observing(el)).toBe(false)
    expect(node_is_connected(el)).toBe(false)
    expect(el.isConnected).toBe(false)

    obs.set(2)
    expect(count).toBe(1)
  })

  test("re-appending restarts observation", () => {
    const obs = o(1)
    let count = 0
    const el = document.createElement("div")
    $observe(obs, () => {
      count++
    })(el)

    node_append(document.body, el)
    expect(count).toBe(1)

    node_remove(el)
    obs.set(2)
    expect(count).toBe(1)

    node_append(document.body, el)
    expect(count).toBe(2)
    expect(node_is_observing(el)).toBe(true)

    obs.set(3)
    expect(count).toBe(3)
    node_remove(el)
  })
})
