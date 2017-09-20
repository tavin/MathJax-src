/*************************************************************
 *
 *  Copyright (c) 2017 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


/**
 * @fileoverview Singleton class for handling symbol maps.
 *
 * @author v.sorge@mathjax.org (Volker Sorge)
 */

import {AbstractSymbolMap, SymbolMap} from './symbol_map.js';
import {Configurations, ParseResult, ParseInput} from './types.js';
import Stack from './stack.js';


export default class MapHandler {

  private static instance: MapHandler;

  private configurations: Map<Configurations, Configuration> = new Map();

  private maps: Map<string, SymbolMap> = new Map();

  /**
   * @return {MapHandler} The singleton MapHandler object.
   */
  public static getInstance(): MapHandler {
    if (!MapHandler.instance) {
      MapHandler.instance = new MapHandler();
    }
    return MapHandler.instance;
  }


  /**
   * Adds a new symbol map to the map handler. Might overwrite an existing
   * symbol map of the same name.
   * 
   * @param {SymbolMap} map Registers a new symbol map.
   */
  public register(map: SymbolMap): void {
    this.maps.set(map.getName(), map);
  }

  /**
   * Looks up a symbol map if it exists.
   * 
   * @param {string} name The name of the symbol map.
   * @return {SymbolMap} The symbol map with the given name or null.
   */
  public getMap(name: string): SymbolMap {
    return this.maps.get(name);
  }

  // Temporary function to allow setting values from legacy code.
  public allMaps(): SymbolMap[] {
    return Array.from(this.maps.values());
  }
  
  /**
   * Sets a new configuration for the map handler.
   * @param {{character: Array.<string>,
   *          delimiter: Array.<string>,
   *          macro: Array.<string>,
   *          environment: Array.<string>}} configuration A setting for the
   *    map handler.
   */
  public configure(config: { [P in Configurations]? : string[]}): void {
    this.configure_(config.delimiter, 'delimiter');
    this.configure_(config.character, 'character');
    this.configure_(config.macro, 'macro');
    this.configure_(config.environment, 'environment');
  }


  /**
   * Appends configurations to the current map handler configuration.
   * @param {{character: Array.<string>,
   *          delimiter: Array.<string>,
   *          macro: Array.<string>,
   *          environment: Array.<string>}} configuration A setting for the
   *    map handler.
   */
  public append(config: { [P in Configurations]? : Array<string>}): void {
    this.append_(config.delimiter, 'delimiter');
    this.append_(config.character, 'character');
    this.append_(config.macro, 'macro');
    this.append_(config.environment, 'environment');
  }


  /**
   * Parses the input with the specified kind of map.
   * @param {Configurations} kind Configuration name.
   * @param {ParseInput} input Input to be parsed.
   * @return {ParseResult} The output of the parsing function.
   */
  public parse(kind: Configurations, input: ParseInput): ParseResult {
    return this.configurations.get(kind).parse(input);
  }


  /**
   * Maps a symbol to its "parse value" if it exists.
   * 
   * @param {Configurations} kind Configuration name.
   * @param {string} symbol The symbol to parse.
   * @return {T} A boolean, Character, or Macro.
   */
  public lookup(kind: Configurations, symbol: string) {
    return this.configurations.get(kind).lookup(symbol);
  }


  /**
   * Checks if a symbol is contained in one of the symbol mappings of the
   * specified kind.
   * 
   * @param {string} symbol The symbol to parse.
   * @return {boolean} True if the symbol is contained in the given types of
   *     symbol mapping.
   */
  public contains(kind: Configurations, symbol: string): boolean {
    return this.configurations.get(kind).contains(symbol);
  }


  /**
   * @override
   */
  public toString(): string {
    let str = '';
    for (const config of Array.from(this.configurations.keys())) {
      str += config + ': ' +
        this.configurations.get(config as Configurations) + '\n';
    }
    return str;
  }

  
  private configure_(config: string[] | null, name: Configurations): void {
    this.configurations.set(name, new Configuration(config || []));
  }

  private append_(config: string[] | null, name: Configurations): void {
    if (!config) {
      return;
    }
    for (const map of config) {
      this.configurations.get(name).add(map);
    }
  }

  /**
   * Dummy constructor
   * @constructor
   */
  private constructor() {
    this.configure({});
  }


}


class Configuration {

  private configuration: SymbolMap[] = [];

  /**
   * @constructor
   */
  constructor(maps: string[]) {
    for (const name of maps) {
      this.add(name);
    }
  }


  /**
   * Adds a symbol map to the configuration if it exists.
   * @param {string} name of the symbol map.
   */
  public add(name: string): void {
    let map = MapHandler.getInstance().getMap(name);
    if (!map) {
      this.warn('Configuration ' + name + ' not found! Omitted.');
      return;
    }
    this.configuration.push(map);
  }


  /**
   * Parses the given input with the first applicable symbol map.
   * @param {ParseInput} input The input for the parser.
   * @return {ParseResult} The output of the parsing function.
   */
  public parse(input: ParseInput): ParseResult {
    // TODO: Can't be done with applicable due to delimiter parsing!
    for (let map of this.configuration) {
      const result = map.parse(input);
      if (result) {
        return result;
      }
    }
    return null;
  }


  /**
   * Maps a symbol to its "parse value" if it exists.
   * 
   * @param {string} symbol The symbol to parse.
   * @return {T} A boolean, Character, or Macro.
   */
  public lookup<T>(symbol: string): T {
    let map = this.applicable(symbol) as AbstractSymbolMap<T>;
    return map ? map.lookup(symbol) : null;
  }


  /**
   * Checks if a symbol is contained in one of the symbol mappings of this
   * configuration.
   * 
   * @param {string} symbol The symbol to parse.
   * @return {boolean} True if the symbol is contained in the mapping.
   */
  public contains(symbol: string): boolean {
    return this.applicable(symbol) ? true : false;
  }


  /**
   * @override
   */
  public toString(): string {
    return this.configuration
      .map(function(x: SymbolMap) {return x.getName(); })
      .join(', ');
  }


  /**
   * Retrieves the first applicable symbol map in the configuration.
   * @param {string} symbol The symbol to parse.
   * @return {SymbolMap} A map that can parse the symbol.
   */
  private applicable(symbol: string): SymbolMap {
    for (let map of this.configuration) {
      if (map.contains(symbol)) {
        return map;
      }
    }
    return null;
  }


  // // TODO: Turn this into a global warning and error functionality
  private warn(message: string) {
    console.log('TexParser Warning: ' + message);
  }

}
