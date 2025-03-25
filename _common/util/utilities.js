/**
 * Various Utilities
 */

/**
 * Simple parameter adjustment GUI
 * uses p5.gui
 * > https://github.com/bitcraftlab/p5.gui
 * which wraps the quicksettings library which you can access
 * through .prototype for extra functionality
 * > https://github.com/bit101/quicksettings
 */
let _paramGui;
let _defaultParams;

function createSettingsGui(params, { load, callback }) {
  _defaultParams = { ...params };

  // load last params
  _savedParams = getItem("params");

  if (load && _savedParams) {
    print(_savedParams);

    for (const key in _savedParams) {
      params[key] = _savedParams[key];
    }
  }

  // settings gui
  _paramGui = createGui("Settings");

  _paramGui.prototype.addButton("Save", function () {
    storeItem("params", params);
  });

  // _paramGui.prototype.addButton("Reset", function () {
  //   for (const key in _defaultParams) {
  //     params[key] = _defaultParams[key];
  //   }
  // });

  _paramGui.addObject(params);

  if (callback) _paramGui.prototype.setGlobalChangeHandler(callback);

  // settingsGui.prototype.addRange('size', 1, 64, 32, 1, function(v) { print("size changed", v) } )

  _paramGui.setPosition(width + 10, 10);
  // the 'H' key hides or shows the GUI
  _paramGui.prototype.setKey("H");
}
