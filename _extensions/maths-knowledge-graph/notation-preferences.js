/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  const LIMITS = Object.freeze({bytes:65536, depth:8, choices:128, keyBytes:64, scopeBytes:256, conceptBytes:4096});
  const fail = () => { throw new Error('Invalid or stale notation choices. Use a current export from this notation registry.'); };
  const bytes = value => {
    if (typeof value !== 'string') fail();
    let total = 0;
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail();
        total += 4;
      } else if (code >= 0xdc00 && code <= 0xdfff) fail();
      else total += code < 128 ? 1 : code < 2048 ? 2 : 3;
    }
    return total;
  };
  const literal = (value, limit) => {
    if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/u.test(value) || bytes(value) > limit) fail();
    return value;
  };
  const key = value => {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value) || bytes(value) > LIMITS.keyBytes) fail();
    return value;
  };
  const record = (value, fields) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== fields.length) fail();
    for (const name of fields) if (!Object.hasOwn(descriptors,name) || !Object.hasOwn(descriptors[name],'value')) fail();
    return value;
  };
  const contextKey = value => JSON.stringify([value.concept,value.scope,value.profile]);
  const list = (value, limit) => {
    if (!Array.isArray(value) || value.length > limit) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== value.length + 1) fail();
    const result = [];
    for (let index = 0; index < value.length; index++) {
      const descriptor = descriptors[index];
      if (!descriptor || !Object.hasOwn(descriptor,'value')) fail();
      result.push(descriptor.value);
    }
    return result;
  };
  const validate = (value, token) => {
    record(value,['version','token','enabled','choices']);
    if (value.version !== 1 || typeof token !== 'string' || !/^[0-9a-f]{40}$/.test(token)
      || value.token !== token || typeof value.enabled !== 'boolean' || !Array.isArray(value.choices)
      || value.choices.length > LIMITS.choices) fail();
    const seen = new Set();
    const choices = list(value.choices,LIMITS.choices).map(choice => {
      record(choice,['profile','concept','scope','variant']);
      const result = {profile:key(choice.profile), concept:literal(choice.concept,LIMITS.conceptBytes),
        scope:literal(choice.scope,LIMITS.scopeBytes),variant:key(choice.variant)};
      if (!/^https?:\/\//.test(result.concept) || /[\s\\<>"{}]/u.test(result.concept)) fail();
      const authority = /^https?:\/\/([^/?#]+)/.exec(result.concept)?.[1];
      const host = authority && /^([A-Za-z0-9.-]+)(?::([0-9]+))?$/.exec(authority);
      if (!host || host[1].startsWith('.') || host[1].endsWith('.') || host[1].includes('..')
        || (host[2] !== undefined && (host[2].length > 5 || Number(host[2]) > 65535))) fail();
      const context = contextKey(result);
      if (seen.has(context)) fail();
      seen.add(context);
      return result;
    });
    choices.sort((a,b) => contextKey(a) < contextKey(b) ? -1 : contextKey(a) > contextKey(b) ? 1 : 0);
    const result = {version:1,token,enabled:value.enabled,choices};
    if (bytes(JSON.stringify(result)) + 1 > LIMITS.bytes) fail();
    return result;
  };
  // JSON.parse alone accepts duplicate keys. Scan the already syntax-checked
  // JSON, including escaped keys, before admitting it as portable preferences.
  const checkStructure = raw => {
    let position = 0;
    const whitespace = () => { while (/[\t\n\r ]/.test(raw[position] || '\0')) position++; };
    const string = () => {
      const start = position++;
      while (position < raw.length) {
        const char = raw[position++];
        if (char === '\\') position++;
        else if (char === '"') return JSON.parse(raw.slice(start,position));
      }
      fail();
    };
    const value = depth => {
      if (depth > LIMITS.depth) fail();
      whitespace();
      const char = raw[position];
      if (char === '{') {
        position++; whitespace();
        const seen = new Set();
        if (raw[position] === '}') {position++;return;}
        do {
          whitespace(); const name = string();
          if (seen.has(name)) fail();
          seen.add(name); whitespace(); position++; value(depth + 1); whitespace();
          if (raw[position++] === '}') return;
        } while (position < raw.length);
      } else if (char === '[') {
        position++; whitespace();
        if (raw[position] === ']') {position++;return;}
        do {value(depth + 1); whitespace(); if (raw[position++] === ']') return;} while (position < raw.length);
      } else if (char === '"') string();
      else {while (position < raw.length && !/[\t\n\r ,}\]]/.test(raw[position])) position++;}
    };
    value(0); whitespace();
    if (position !== raw.length) fail();
  };
  const decode = (raw, token) => {
    if (bytes(raw) > LIMITS.bytes) fail();
    let value;
    try { value = JSON.parse(raw); } catch { fail(); }
    checkStructure(raw);
    return validate(value,token);
  };
  const resolve = ({siteDefault,pageDefault,override,readerChoice,variants}) => {
    if (!Array.isArray(variants) || variants.length < 1 || variants.length > 12) fail();
    const available = new Set(variants.map(key));
    if (available.size !== variants.length || !available.has(key(siteDefault))) fail();
    if (pageDefault !== undefined && !available.has(key(pageDefault))) fail();
    if (override !== undefined && !available.has(key(override))) fail();
    if (override !== undefined) return {variant:override,source:'page-override',locked:true};
    if (typeof readerChoice === 'string' && available.has(readerChoice)) return {variant:readerChoice,source:'reader-preference',locked:false};
    if (pageDefault !== undefined) return {variant:pageDefault,source:'page-default',locked:false};
    return {variant:siteDefault,source:'site-default',locked:false};
  };
  const encode = value => {
    const validated = validate(value,value?.token);
    let result = JSON.stringify(validated,null,2) + '\n';
    if (bytes(result) > LIMITS.bytes) result = JSON.stringify(validated) + '\n';
    return result;
  };
  globalThis.MathsKnowledgeGraphNotationPreferences = Object.freeze({version:1,LIMITS,decode,validate,resolve,encode,contextKey});
})();
