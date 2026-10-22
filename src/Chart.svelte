<div class="mt-15">
    <div class="chart">
        <svg bind:this={svgEl}></svg>
        <div class="tooltip" bind:this={tooltipEl}></div>
    </div>
</div>

<script lang="ts">
    import * as d3 from 'd3';

    type ChartData = {
        time: Array<string>;
        temperature_mean: Array<number>;
        temperature_p10: Array<number>;
        temperature_p90: Array<number>;
    };

    export let data: ChartData | null = null;
    export let unit = '';

    let svgEl: SVGSVGElement;
    let tooltipEl: HTMLDivElement;

    $: {
        if (data && svgEl) {
            drawTheGraph(data);
        }
    }

    const drawTheGraph = (chartData: ChartData) => {
        const timestamps = chartData.time.map(t => new Date(t).getTime());
        const firstTimestamp = timestamps[0];
        const lastTimestamp = timestamps[timestamps.length - 1];

        const margin = { top: 5, right: 5, bottom: 20, left: 40 };
        const width = svgEl.clientWidth - margin.left - margin.right;
        const height = svgEl.clientHeight - margin.top - margin.bottom;

        const svg = d3.select(svgEl);
        svg.selectAll('*').remove();

        const innerSvg = svg
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const xScale = d3
            .scaleTime()
            .domain([new Date(firstTimestamp), new Date(lastTimestamp)])
            .range([0, width]);

        const allValues = [
            ...chartData.temperature_mean,
            ...chartData.temperature_p10,
            ...chartData.temperature_p90,
        ];
        const yScale = d3
            .scaleLinear()
            .domain([d3.min(allValues) as number, d3.max(allValues) as number])
            .nice()
            .range([height, 0]);

        const days = d3.timeDay.range(new Date(firstTimestamp), new Date(lastTimestamp));
        const yTicks = yScale.ticks(5);

        // Draw horizontal lines for each y tick
        yTicks.forEach(value => {
            innerSvg
                .append('line')
                .attr('x1', 0)
                .attr('y1', yScale(value))
                .attr('x2', width)
                .attr('y2', yScale(value))
                .attr('stroke', 'lightgray')
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 0.3);
        });

        // Emphasize the 0 °C line if it is within the domain
        const [yMin, yMax] = yScale.domain();
        if (yMin <= 0 && 0 <= yMax) {
            innerSvg
                .append('line')
                .attr('x1', 0)
                .attr('y1', yScale(0))
                .attr('x2', width)
                .attr('y2', yScale(0))
                .attr('stroke', 'lightgray')
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 1);
        }

        // Draw a vertical dashed line for each midnight
        days.filter(d => d.getTime() > firstTimestamp && d.getTime() < lastTimestamp).forEach(d => {
            innerSvg
                .append('line')
                .attr('x1', xScale(d))
                .attr('y1', 0)
                .attr('x2', xScale(d))
                .attr('y2', height + 5)
                .attr('stroke', 'lightgray')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5');
        });

        const line = d3
            .line<number>()
            .x((_, i) => xScale(new Date(timestamps[i])))
            .y(value => yScale(value));

        const band = d3
            .area<number>()
            .x((_, i) => xScale(new Date(timestamps[i])))
            .y0((_, i) => yScale(chartData.temperature_p90[i]))
            .y1((_, i) => yScale(chartData.temperature_p10[i]));

        // Shaded band between p10 and p90 (drawn first so the lines are on top)
        innerSvg
            .append('path')
            .datum(timestamps)
            .attr('fill', 'lightblue')
            .attr('fill-opacity', 0.2)
            .attr('stroke', 'none')
            .attr('d', band);

        // Draw the p10 and p90 lines (drawn first so the mean line is on top)
        [chartData.temperature_p10, chartData.temperature_p90].forEach(values => {
            innerSvg
                .append('path')
                .datum(values)
                .attr('fill', 'none')
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 0.5)
                .attr('d', line);
        });

        // Main temperature mean line
        innerSvg
            .append('path')
            .datum(chartData.temperature_mean)
            .attr('fill', 'none')
            .attr('stroke', 'lightblue')
            .attr('stroke-width', 3)
            .attr('d', line);

        // X axis
        const xAxis = d3.axisBottom(xScale).tickValues(days).tickFormat(d3.timeFormat('%a %d'));

        innerSvg
            .append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis)
            .selectAll('.tick line')
            .attr('stroke-width', 0);

        // Y axis
        const yAxis = d3.axisLeft(yScale).tickValues(yTicks);

        innerSvg.append('g').call(yAxis);

        // Y axis label (temperature unit)
        if (unit) {
            innerSvg
                .append('text')
                .attr('transform', `translate(-25, ${height / 2}) rotate(-90)`)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', 'white')
                .text(unit);
        }

        // Tooltip: vertical guide line, dot on the mean line, invisible overlay
        const guideLine = innerSvg
            .append('line')
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0);

        const dot = innerSvg
            .append('circle')
            .attr('r', 4)
            .attr('fill', 'lightblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0);

        const tooltip = d3.select(tooltipEl);
        const dateLabelFormat = d3.timeFormat('%a %d %b %H:%M');
        const formatTemp = (v: number) => `${v.toFixed(1)} ${unit}`;
        const bisectTime = d3.bisector((t: number) => t).left;

        const onMove = (event: PointerEvent) => {
            const [mx] = d3.pointer(event, innerSvg.node());
            const time = xScale.invert(mx).getTime();

            // Nearest data point to the cursor's x position
            let i = bisectTime(timestamps, time);
            if (i >= timestamps.length) i = timestamps.length - 1;
            if (i > 0 && Math.abs(timestamps[i - 1] - time) <= Math.abs(timestamps[i] - time)) {
                i -= 1;
            }

            const px = xScale(new Date(timestamps[i]));
            const mean = chartData.temperature_mean[i];
            const p10 = chartData.temperature_p10[i];
            const p90 = chartData.temperature_p90[i];

            guideLine.attr('x1', px).attr('x2', px).attr('opacity', 0.6);
            dot.attr('cx', px).attr('cy', yScale(mean)).attr('opacity', 1);

            tooltip
                .style('opacity', 1)
                .html(
                    `<div class="tooltip-date">${dateLabelFormat(new Date(timestamps[i]))}</div>` +
                        `<div class="tooltip-row"><span>Mean</span> <span>${formatTemp(mean)}</span></div>` +
                        `<div class="tooltip-row"><span>P10</span> <span>${formatTemp(p10)}</span></div>` +
                        `<div class="tooltip-row"><span>P90</span> <span>${formatTemp(p90)}</span></div>`,
                );

            // Position next to the cursor, flipping to the left near the right edge
            const [cx, cy] = d3.pointer(event, tooltipEl.parentElement!);
            const offset = 14;
            const left =
                cx + offset + tooltipEl.offsetWidth > tooltipEl.parentElement!.clientWidth
                    ? cx - offset - tooltipEl.offsetWidth
                    : cx + offset;
            tooltip.style('left', `${left}px`).style('top', `${cy - tooltipEl.offsetHeight / 2}px`);
        };

        const onLeave = () => {
            guideLine.attr('opacity', 0);
            dot.attr('opacity', 0);
            tooltip.style('opacity', 0);
        };

        innerSvg
            .append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair')
            .on('pointermove', onMove)
            .on('pointerleave', onLeave);
    };
</script>

<style lang="less">
    svg {
        width: 100%;
        height: 200px;
    }
    .chart {
        position: relative;
    }

    .tooltip {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        pointer-events: none;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.5;
        color: white;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.15s ease;

        .tooltip-date {
            font-weight: 600;
            margin-bottom: 2px;
        }

        .tooltip-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
        }
    }
</style>
