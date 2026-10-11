/*
 * Exports what's inside an After Effects project to JSON, for the portfolio's
 * bookshelf: its comps, the main comp's timeline, the effects and fonts used,
 * and how many layers, keyframes and expressions it took. Footage paths are
 * left out (only file types are counted).
 *
 * In After Effects: File > Scripts > Run Script File... With a project open it
 * exports that project (nothing in it changes); with none open it asks for
 * .aep files. Save the JSON into content/after-effects/ in the portfolio repo
 * and it shows up on the bookshelf; card titles go in content/after-effects.ts.
 *
 * Needs Edit > Preferences > Scripting & Expressions > "Allow Scripts to Write
 * Files and Access Network".
 *
 * Batch, without dialogs: define AE_EXPORT = { files: ["D:/a.aep"], out:
 * "C:/porfolio/content/after-effects", quit: true } and then $.evalFile this
 * script. Each project is opened and closed again without saving.
 */
(function () {
  var TIMELINE_LAYERS = 60;

  /* ------------------------------------------------------------- JSON */

  function quote(s) {
    var out = '"';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var code = s.charCodeAt(i);
      if (c === '"' || c === "\\") out += "\\" + c;
      else if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (code < 32 || code > 126) out += "\\u" + ("0000" + code.toString(16)).slice(-4);
      else out += c;
    }
    return out + '"';
  }

  function toJSON(v, indent) {
    indent = indent || "";
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 1000) / 1000) : "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return quote(v);
    var next = indent + "  ";
    var parts = [];
    var i;
    if (v instanceof Array) {
      if (!v.length) return "[]";
      var flat = true;
      for (i = 0; i < v.length; i++) if (typeof v[i] === "object" && v[i] !== null) flat = false;
      for (i = 0; i < v.length; i++) parts.push(toJSON(v[i], next));
      return flat ? "[" + parts.join(", ") + "]" : "[\n" + next + parts.join(",\n" + next) + "\n" + indent + "]";
    }
    for (var k in v) {
      if (v.hasOwnProperty(k) && v[k] !== undefined) parts.push(quote(k) + ": " + toJSON(v[k], next));
    }
    return parts.length ? "{\n" + next + parts.join(",\n" + next) + "\n" + indent + "}" : "{}";
  }

  function writeText(path, text) {
    var f = new File(path);
    f.encoding = "UTF-8";
    f.lineFeed = "Unix";
    if (!f.open("w")) throw new Error("Can't write " + path);
    f.write(text);
    f.close();
  }

  /* ------------------------------------------------------------ helpers */

  var effectNames = null;
  /**
   * The effect's display name and category, from AE's own list. Effects that
   * aren't installed (or pseudo effects with no display name) fall back to
   * the name given to the instance on the layer.
   */
  function effectInfo(e) {
    if (!effectNames) {
      effectNames = {};
      for (var i = 0; i < app.effects.length; i++) {
        var fx = app.effects[i];
        effectNames[fx.matchName] = { name: fx.displayName, category: fx.category, installed: true };
      }
    }
    var known = effectNames[e.matchName];
    if (known && known.name) return known;
    return { name: e.name || e.matchName, category: known ? known.category : "", installed: !!known };
  }

  function kindOf(l) {
    if (l instanceof TextLayer) return "text";
    if (l instanceof ShapeLayer) return "shape";
    if (l instanceof CameraLayer) return "camera";
    if (l instanceof LightLayer) return "light";
    if (l.nullLayer) return "null";
    if (l.adjustmentLayer) return "adjustment";
    var s = l.source;
    if (s instanceof CompItem) return "precomp";
    if (s instanceof FootageItem) {
      if (s.mainSource instanceof SolidSource) return "solid";
      if (s.mainSource instanceof PlaceholderSource) return "placeholder";
      if (!s.hasVideo && s.hasAudio) return "audio";
      if (s.mainSource.isStill) return "image";
      return "video";
    }
    return "layer";
  }

  /** Keyframes and live expressions under a property group. */
  function walk(group, acc) {
    var n = 0;
    try {
      n = group.numProperties;
    } catch (e) {
      return;
    }
    for (var i = 1; i <= n; i++) {
      var p;
      try {
        p = group.property(i);
      } catch (e) {
        continue;
      }
      if (!p) continue;
      if (p.propertyType === PropertyType.PROPERTY) {
        try {
          if (p.numKeys) acc.keys += p.numKeys;
          if (p.canSetExpression && p.expressionEnabled && p.expression !== "") acc.expressions++;
        } catch (e) {}
      } else {
        walk(p, acc);
      }
    }
  }

  function round(x, d) {
    var m = Math.pow(10, d);
    return Math.round(x * m) / m;
  }

  function sortedCounts(map, key) {
    var out = [];
    for (var k in map) if (map.hasOwnProperty(k)) out.push(map[k]);
    out.sort(function (a, b) {
      return b[key] - a[key];
    });
    return out;
  }

  function extOf(name) {
    var dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  }

  /* ------------------------------------------------------------- export */

  function describe(project, fileName) {
    var counts = {
      comps: 0,
      footage: 0,
      solids: 0,
      folders: 0,
      layers: 0,
      keyframes: 0,
      expressions: 0,
      effects: 0,
      text: 0,
      shape: 0,
      precomp: 0,
      adjustment: 0,
      "null": 0,
      camera: 0,
      light: 0,
      missingFootage: 0,
      missingEffects: 0
    };
    var comps = [];
    var effects = {};
    var fonts = {};
    var footageTypes = {};
    var compByItem = {};
    var layerStats = {};

    for (var i = 1; i <= project.numItems; i++) {
      var item = project.item(i);
      if (item instanceof FolderItem) {
        counts.folders++;
      } else if (item instanceof CompItem) {
        counts.comps++;
      } else if (item instanceof FootageItem) {
        if (item.mainSource instanceof SolidSource) counts.solids++;
        else {
          counts.footage++;
          if (item.footageMissing) counts.missingFootage++;
          var ext = item.mainSource instanceof FileSource && item.mainSource.file ? extOf(item.mainSource.file.name) : "";
          if (ext) footageTypes[ext] = { type: ext, count: (footageTypes[ext] ? footageTypes[ext].count : 0) + 1 };
        }
      }
    }

    for (i = 1; i <= project.numItems; i++) {
      var comp = project.item(i);
      if (!(comp instanceof CompItem)) continue;
      var c = {
        name: comp.name,
        width: comp.width,
        height: comp.height,
        fps: round(comp.frameRate, 3),
        duration: round(comp.duration, 3),
        layers: comp.numLayers,
        usedIn: comp.usedIn.length
      };
      comps.push(c);
      compByItem[comp.id] = comp;

      for (var j = 1; j <= comp.numLayers; j++) {
        var l = comp.layer(j);
        counts.layers++;
        var kind = kindOf(l);
        if (counts[kind] !== undefined) counts[kind]++;
        var acc = { keys: 0, expressions: 0 };
        walk(l, acc);
        counts.keyframes += acc.keys;
        counts.expressions += acc.expressions;

        var fx = [];
        var parade = null;
        try {
          parade = l.property("ADBE Effect Parade");
        } catch (err) {}
        if (parade) {
          for (var k = 1; k <= parade.numProperties; k++) {
            var e = parade.property(k);
            var info = effectInfo(e);
            if (!info.installed) counts.missingEffects++;
            counts.effects++;
            fx.push(info.name);
            var key = e.matchName;
            if (!effects[key]) effects[key] = { name: info.name, matchName: e.matchName, category: info.category, count: 0 };
            effects[key].count++;
          }
        }

        if (kind === "text") {
          try {
            var doc = l.property("ADBE Text Properties").property("ADBE Text Document").value;
            var family = doc.fontFamily || doc.font;
            var style = doc.fontStyle || "";
            var fk = family + "|" + style;
            if (!fonts[fk]) fonts[fk] = { family: family, style: style, count: 0 };
            fonts[fk].count++;
          } catch (err) {}
        }
        layerStats[comp.id + ":" + j] = { kind: kind, keys: acc.keys, expressions: acc.expressions, effects: fx };
      }
    }

    // the main comp: the longest top-level comp (not nested in another) that
    // holds more than one layer, so controller and single-clip comps don't
    // win; the render queue is too often left over from a test render to trust
    var main = null;
    var mainReason = "longest top-level comp";
    for (var pass = 0; pass < 2 && !main; pass++) {
      for (var id in compByItem) {
        if (!compByItem.hasOwnProperty(id)) continue;
        var cand = compByItem[id];
        if (cand.usedIn.length || (pass === 0 && cand.numLayers < 2)) continue;
        if (!main || cand.duration > main.duration || (cand.duration === main.duration && cand.numLayers > main.numLayers)) main = cand;
      }
    }

    var timeline = null;
    if (main) {
      var rows = [];
      for (j = 1; j <= main.numLayers && rows.length < TIMELINE_LAYERS; j++) {
        var ml = main.layer(j);
        var st = layerStats[main.id + ":" + j];
        rows.push({
          name: ml.name,
          kind: st.kind,
          "in": round(Math.max(0, ml.inPoint), 3),
          out: round(Math.min(main.duration, ml.outPoint), 3),
          enabled: ml.enabled,
          keyframes: st.keys,
          expressions: st.expressions,
          effects: st.effects
        });
      }
      timeline = {
        comp: main.name,
        reason: mainReason,
        width: main.width,
        height: main.height,
        fps: round(main.frameRate, 3),
        duration: round(main.duration, 3),
        totalLayers: main.numLayers,
        layers: rows
      };
    }

    return {
      file: fileName,
      exportedAt: new Date().toUTCString(),
      aeVersion: app.version,
      bitsPerChannel: project.bitsPerChannel,
      counts: counts,
      main: timeline,
      effects: sortedCounts(effects, "count"),
      fonts: sortedCounts(fonts, "count"),
      footageTypes: sortedCounts(footageTypes, "count"),
      comps: comps
    };
  }

  function slugOf(fileName) {
    return fileName
      .replace(/\.aepx?$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function exportProject(project, outFolder, log) {
    var name = project.file ? project.file.displayName : "untitled.aep";
    var data = describe(project, name);
    var path = outFolder + "/" + slugOf(name) + ".json";
    writeText(path, toJSON(data) + "\n");
    log(name + " -> " + path + " (" + data.counts.comps + " comps, " + data.counts.layers + " layers)");
    return path;
  }

  /* --------------------------------------------------------------- main */

  var batch = typeof AE_EXPORT !== "undefined" ? AE_EXPORT : null;
  var lines = [];
  var log = function (s) {
    lines.push(s);
    if (batch && batch.log) writeText(batch.log, lines.join("\n") + "\n");
  };

  if (batch) {
    // batch mode opens and closes projects, so it only runs on an empty After
    // Effects: never touch a project someone has open
    if (app.project && (app.project.file || app.project.numItems > 0)) {
      log("not run: a project is open (" + (app.project.file ? app.project.file.fsName : "untitled") + ")");
      return;
    }
    app.beginSuppressDialogs();
    for (var i = 0; i < batch.files.length; i++) {
      try {
        var f = new File(batch.files[i]);
        if (!f.exists) {
          log("missing: " + batch.files[i]);
          continue;
        }
        var project = app.open(f);
        exportProject(project, batch.out, log);
        project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      } catch (err) {
        log("failed: " + batch.files[i] + ": " + err.toString() + " (line " + err.line + ")");
        try {
          app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        } catch (e2) {}
      }
    }
    app.endSuppressDialogs(false);
    log("done");
    if (batch.quit) app.quit();
    return;
  }

  // interactive
  var savedOut = app.settings.haveSetting("portfolio", "aeExportOut") ? app.settings.getSetting("portfolio", "aeExportOut") : "";
  var outFolder = Folder.selectDialog("Save the project info JSON where? (the repo's content/after-effects folder)", savedOut ? new Folder(savedOut) : undefined);
  if (!outFolder) return;
  app.settings.saveSetting("portfolio", "aeExportOut", outFolder.fsName);

  if (app.project && app.project.file) {
    exportProject(app.project, outFolder.fsName, log);
  } else {
    var picked = File.openDialog("Pick the .aep files to export", "After Effects projects:*.aep;*.aepx", true);
    if (!picked) return;
    if (!(picked instanceof Array)) picked = [picked];
    for (var p = 0; p < picked.length; p++) {
      try {
        var proj = app.open(picked[p]);
        exportProject(proj, outFolder.fsName, log);
        proj.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      } catch (err) {
        log("failed: " + picked[p].fsName + ": " + err.toString());
      }
    }
  }
  alert("Exported:\n" + lines.join("\n"));
})();
