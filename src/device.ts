import { Logger } from 'homebridge';
import fetch from 'whatwg-fetch';

export interface IDevice {
  ID: string;
  Name: string;
  Status: string;
  On: boolean;
  CurrentTemperature: number;
  TargetTemperature: number;
  CurrentPower: number;
  isHeating: boolean;
  setTargetTemperature: (value: number) => void;
  setOn: (value: boolean) => void;
  update: () => void;
}

const INDIVIDUAL_MODE = 'Control individually';

export default class MillDevice implements IDevice {
  private _mac = '';
  private _status = 'unknown';
  private _mode = 'unknown';
  private _currentTemperature = 0;
  private _targetTemperature = 0;
  private _currentPower = 0;

  get ID() {
    return this._mac;
  }

  get Name() {
    return this._name;
  }

  get Status() {
    return this._status;
  }

  get On() {
    return this._mode !== 'off';
  }

  get CurrentTemperature() {
    return this._currentTemperature;
  }

  get TargetTemperature() {
    return this._targetTemperature;
  }

  get CurrentPower() {
    return this._currentPower;
  }

  get isHeating() {
    return this._currentPower > 0;
  }

  constructor(
    private readonly _name: string,
    private readonly _ip: string,
    private readonly log: Logger,
  ) {
    this.log.info(`Setting up device ${this._name}`);
  }

  async init() {
    await this.update();
  }

  async update() {
    try {
      const { mac_address, status } = await this._get<StatusResponse>('status');
      const {
        ambient_temperature,
        current_power,
        set_temperature,
        operation_mode,
      } = await this._get<ControlStatusResponse>('control-status');

      this._mac = mac_address;
      this._status = status;
      this._mode = operation_mode;
      this._currentTemperature = ambient_temperature;
      this._targetTemperature = set_temperature;
      this._currentPower = current_power;
    } catch(ex) {
      this.log.error(`Failed to fetch data from ${this._name}`);
    }
  }

  setTargetTemperature(target: number) {
    this._post<SimpleResponse>('set-temperature', {
      type: 'Normal',
      value: target,
    }).then(({ status }) => {
      if (status === 'ok') {
        // Optimistic update
        this._targetTemperature = target;
      }
    });
  }

  async setOn(on) {
    const targetMode = on ? INDIVIDUAL_MODE : 'off';
    await this._post<SimpleResponse>('operation-mode', {
      mode: targetMode,
    }).then(({ status }) => {
      if (status === 'ok') {
        this._mode = targetMode;
      }
    });

    await this.update();
  }

  _get<T>(command: string): Promise<T> {
    this.log.debug(`GET from http://${this._ip}/${command}`);
    return fetch(`http://${this._ip}/${command}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json() as Promise<T>);
  }

  _post<T>(command: string, data: Record<string, number | string>): Promise<T> {
    this.log.debug(`POST to http://${this._ip}/${command} with data: ${JSON.stringify(data)}`);
    return fetch(`http://${this._ip}/${command}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then((res) => res.json() as Promise<T>);
  }
}

/** Response types */
type SimpleResponse = {
  status: string;
};
type ControlStatusResponse = {
  ambient_temperature: number;
  current_power: number;
  control_signal: number;
  lock_active: string;
  open_window_active_now: string;
  raw_ambient_temperature: number;
  set_temperature: number;
  switched_on: boolean;
  connected_to_cloud: boolean;
  operation_mode: string;
  status: string;
};
type StatusResponse = {
  name: string;
  custom_name: string;
  version: string; //"0x231124",
  operation_key: string;
  mac_address: string;
  status: string;
};
