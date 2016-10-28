/**
 * Copyright 2016-present, jianghai.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import { Component } from 'react'
import immutabilityUpdate from 'immutability-helper'

const commands = {

  set(value) {
    return {$set: value}
  },

  push(value) {
    return {$push: [value]}
  },
  
  splice(value) {
    return {$splice: [[value, 1]]}
  }
}

// Immutability update data using type, path, value.
const updateHelper = {

  getImmutabilitySugarCommand(type, value) {
    return commands[type](value)
  },

  // [a, b] with 1 => {a: {b: 1}}
  getNestedData(path, value) {
    let target = {}
    let lastKey
    if (path) {
      let temp = target
      if (Array.isArray(path)) {
        lastKey = path.pop()
        path.forEach(key => {
          temp[key] = {}
          temp = temp[key]
        })
      } else {
        lastKey = path
      }
      temp[lastKey] = value
    } else {
      target = value
    }
    return target
  },

  getImmutabilitySugar(type, path, value) {
    const command = updateHelper.getImmutabilitySugarCommand(type, value)
    return updateHelper.getNestedData(path, command)
  },

  update(source, type, path, value) {
    const sugar = updateHelper.getImmutabilitySugar(type, path, value)
    return immutabilityUpdate(source, sugar)
  }
}

const LAST_STATE = '__lastState'

function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

// 'a.b.c' => ['a', 'b', 'c']
function getPathArray(path) {
  if (typeof path === 'string') {
    path = path.split(/\.|\[|\]/).filter(v => !!v)
  }
  return path
}

// Destruct path with first prop and remain path.
// Such as: 'a.b.c' or ['a', 'b', 'c'] and return ['a', ['b', 'c']].
function getDestructPath(path) {
  path = getPathArray(path)
  const prop = path.shift()
  if (!path.length) path = null
  return [prop, path]
}

// Cache last state when call update multiple times.
// Warn: take care of it when react update.
function getCachedLastState(instance) {
  const internalInstance = instance._reactInternalInstance
  const queue = internalInstance && internalInstance._pendingStateQueue
  if (queue) {
    if (instance[LAST_STATE]) {
      Object.assign(instance[LAST_STATE], queue.pop())
    } else {
      instance[LAST_STATE] = Object.assign({}, instance.state, queue.pop())
    }
  } else {
    delete instance[LAST_STATE]
  }
  return instance[LAST_STATE]
}

function updateState(...args) {

  const [type, path, value] = args
  const lastState = getCachedLastState(this) || this.state
  const nextState = {}

  function updateNextState(type, path, value) {
    if (isPlainObject(path)) {
      // For multipe props
      Object.keys(path).forEach(key => {
        updateNextState(type, key, path[key])
      })
    } else {
      const [prop, remainPath] = getDestructPath(path)
      if (!remainPath && type === 'set') {
        // No need to update immutably
        nextState[prop] = value
      } else {
        // Prevent to be overrided when call update by multipe props
        if (prop in nextState) {
          lastState[prop] = nextState[prop]
        }
        nextState[prop] = updateHelper.update(lastState[prop], type, remainPath, value)
      }
    }
  }

  updateNextState(type, path, value)
  this.setState(nextState)

  const keys = Object.keys(nextState)
  return keys.length === 1 ? nextState[keys[0]] : nextState
}

function updateSilent(...args) {
  const [source, type, path, value] = args
  return updateHelper.update(source, type, getPathArray(path), value)
}

// If you bind update to the instance of React Component, the arguments could be 
// [type, path, value] or [type, {path1: value1, path2: value2}] which was changed 
// based on the component state and execute stateState automatically. 
// Another way, if you call update purely, the argumets could be 
// [target, type, path, value], the path is not required and will not execute stateState.
// Anyway, the return value of update would be the newData, if you changed multuple 
// props, the newData would be an key-value object.
function update(...args) {
  if (this && this.isReactComponent) {
    return updateState.apply(this, args)
  } else {
    return updateSilent(...args)
  }
}

export default update