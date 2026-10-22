<div class="mt-15">
    <svg bind:this={svgEl}></svg>
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

        // Draw the p10 and p90 lines (drawn first so the mean line is on top)
        [chartData.temperature_p10, chartData.temperature_p90].forEach(values => {
            innerSvg
                .append('path')
                .datum(values)
                .attr('fill', 'none')
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
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
    };
</script>

<style lang="less">
    svg {
        width: 100%;
        height: 200px;
    }
</style>
