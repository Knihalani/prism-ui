# Chart geometry

Dependency-free SVG geometry. Import named exports from `chart/index` or individual
modules. No DOM, React, locale or timezone globals are changed.

- `niceTicks(min,max,count)` returns **extended** 1–2–5 ticks; `tickFormat(step)`
  returns a fixed-precision formatter. `timeTicks` returns Date objects **inside**
  the extent, calendar-aligned (UTC by default; `{utc:false}` uses local time).
- `scaleLinear`, `scaleTime`, `scaleBand` return `{domain,range,map,invert,copy,...}`.
  Numeric/time scales have `ticks(count)`. Band scales expose numeric `bandwidth`,
  `step`, `index(key)` and `indexAt(pointer)`; hover snaps gaps to the closest band
  center, and returns -1 outside the range. Domains are copied, duplicate bands removed.
- `linePath` accepts `[x,y]` or `{x,y}`, with null/invalid points creating gaps.
  `areaPath(top, baseline=0, options)` accepts a scalar or matched bottom points.
  Options: `{curve:'linear'|'step'|'monotone', precision:2, defined?}`. Monotone
  paths use Fritsch–Carlson limiting. Line/area paths pack coordinates once, reuse
  numeric/output buffers, and encode rounded coordinates directly into SVG bytes.
  Binary rounding ties and extreme values retain `toFixed` precision semantics.
  `barPath({x,y,width,height,radius,topOnly})`
  normalizes negative sizes; `topOnly` refers to the visual top.
- `pie(values, options)` retains input order in its result; `order` records angular
  sort order (`sort:true` sorts descending). Negative/non-finite values have zero
  area. Padding is already removed from each arc's angles. Angles are radians,
  clockwise from 12 o'clock. `arcPath` supports donuts, full circles and rounded
  corners (quadratic corner joins). `arcCentroid`, `arcLabel` return coordinates;
  `arcLabel` includes a three-point `leader`, `side` and text `anchor`.
- `stack(rows,keys,{offset})` returns arrays of `[y0,y1]` with a `key` property.
  Missing values are zero. `expand` divides signed values by their absolute total;
  `diverging` separates positive and negative baselines.
- Label boxes use `{x,y,w,h,priority?}`, x/y at the top-left. `thinAxisLabels`
  selects a regular stride; forced first/last labels may overlap if neither fits.
  `placeLabels` tries offsets in priority order and returns `{placed,dropped}`.
  `relaxPieLabels` fits each side vertically, dropping low-priority labels if needed.
  Use placed coordinates to update leader line endpoints.
- `nearestX(sortedXs,x)` returns an index (ties go left); it is O(log n) for finite
  sorted inputs, with a linear fallback for encountered invalid values.
  `nearestPoint(series,x,y,maxDistance?)` scans 2-D points with x-distance pruning
  and exits on exact matches. `bandIndex(pointer,band)` delegates to `indexAt`.
- `pivotLongToWide(rows,{x,series,value,aggregate?})`,
  `pivotWideToLong(rows,{x,keys,series?,value?})`,
  `aggregate(rows,{x,series?,value,op})`, `switchX(rows,field,xField='x')`,
  `topN(rows,key,n,{otherLabel:'Other',labelKey:'label'})`, `sortBy(rows,key,direction)`
  never mutate inputs. Aggregation ignores invalid numeric values; count counts
  rows; empty averages/min/max are null. Series names colliding with x throw.
- `createStableDomain({hysteresis:.1,nice:true,includeZero,tickCount:5})` accepts
  `update(values)`, `update({min,max})`, or `update(min,max)`; only `reset()` permits
  shrinking. Empty initial updates return [0,1] without initializing the domain.
  `createExtentTracker(accessor?)` has `append(batch)` and `update(fullArray)`;
  update examines only appended items, resets on truncation, and assumes earlier
  items have not changed. `extent` is undefined until a finite value arrives.

Invalid numeric mapping returns NaN so renderers can omit a mark. Empty geometry
returns an empty path/array. All geometry is local to the origin; translate arcs
in the consuming SVG. Output numbers default to two decimals, without trailing zeros.
