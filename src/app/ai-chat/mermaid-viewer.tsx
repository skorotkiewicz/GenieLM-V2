import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { observeResize } from "@astryxdesign/core/utils";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
	type PointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { RenderedMermaid } from "#/lib/mermaid-preview";

const zoomLevels = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const fitZoomIndex = zoomLevels.indexOf(1);

export function MermaidViewer({
	image: { src, width, height },
	title,
}: {
	image: RenderedMermaid;
	title: string;
}) {
	const root = useRef<HTMLElement>(null);
	const viewport = useRef<HTMLElement>(null);
	const [fit, setFit] = useState(1);
	const [zoomIndex, setZoomIndex] = useState(fitZoomIndex);
	const zoom = zoomLevels[zoomIndex];
	const focus = useRef<{ x: number; y: number } | null>(null);
	const drag = useRef<{
		pointerId: number;
		x: number;
		y: number;
		left: number;
		top: number;
	} | null>(null);

	useEffect(() => {
		const container = root.current;
		const canvas = viewport.current;
		if (!container || !canvas) return;

		const measure = () => {
			const availableHeight = Number.parseFloat(
				getComputedStyle(canvas).maxBlockSize,
			);
			const availableWidth = container.getBoundingClientRect().width;
			if (availableWidth > 0 && availableHeight > 0) {
				setFit(Math.min(1, availableWidth / width, availableHeight / height));
			}
		};

		const unsubscribe = observeResize(container, measure);
		window.addEventListener("resize", measure);
		window.visualViewport?.addEventListener("resize", measure);
		return () => {
			unsubscribe();
			window.removeEventListener("resize", measure);
			window.visualViewport?.removeEventListener("resize", measure);
		};
	}, [width, height]);

	useLayoutEffect(() => {
		const canvas = viewport.current;
		if (!canvas) return;
		if (zoomIndex === fitZoomIndex) {
			canvas.scrollLeft = 0;
			canvas.scrollTop = 0;
		} else if (focus.current) {
			const { x, y } = focus.current;
			canvas.scrollLeft = x * canvas.scrollWidth - canvas.clientWidth / 2;
			canvas.scrollTop = y * canvas.scrollHeight - canvas.clientHeight / 2;
		}
		focus.current = null;
	}, [zoomIndex]);

	function changeZoom(index: number) {
		const canvas = viewport.current;
		if (canvas?.scrollWidth && canvas.scrollHeight) {
			focus.current = {
				x: (canvas.scrollLeft + canvas.clientWidth / 2) / canvas.scrollWidth,
				y: (canvas.scrollTop + canvas.clientHeight / 2) / canvas.scrollHeight,
			};
		}
		setZoomIndex(index);
	}

	function startPan(event: PointerEvent<HTMLElement>) {
		// Touch and trackpads use the scrollable viewport directly.
		if (event.pointerType !== "mouse" || event.button !== 0) return;
		const canvas = event.currentTarget;
		if (
			canvas.scrollWidth <= canvas.clientWidth &&
			canvas.scrollHeight <= canvas.clientHeight
		)
			return;

		event.preventDefault();
		canvas.setPointerCapture(event.pointerId);
		drag.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: canvas.scrollLeft,
			top: canvas.scrollTop,
		};
	}

	function pan(event: PointerEvent<HTMLElement>) {
		const start = drag.current;
		if (!start || start.pointerId !== event.pointerId) return;
		event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
		event.currentTarget.scrollTop = start.top + start.y - event.clientY;
	}

	function stopPan(event: PointerEvent<HTMLElement>) {
		if (drag.current?.pointerId === event.pointerId) drag.current = null;
	}

	return (
		<VStack ref={root} gap={1} width="100%" data-mermaid-viewer="">
			<HStack
				gap={1}
				hAlign="end"
				vAlign="center"
				role="group"
				aria-label="Diagram zoom"
			>
				<Button
					label="Zoom out"
					tooltip="Zoom out"
					variant="ghost"
					size="sm"
					isIconOnly
					icon={<Icon icon={Minus} size="sm" />}
					isDisabled={zoomIndex === 0}
					onClick={() => changeZoom(zoomIndex - 1)}
				/>
				<Text
					type="supporting"
					color="secondary"
					hasTabularNumbers
					aria-live="polite"
				>
					{Math.round(zoom * 100)}%
				</Text>
				<Button
					label="Zoom in"
					tooltip="Zoom in"
					variant="ghost"
					size="sm"
					isIconOnly
					icon={<Icon icon={Plus} size="sm" />}
					isDisabled={zoomIndex === zoomLevels.length - 1}
					onClick={() => changeZoom(zoomIndex + 1)}
				/>
				<Button
					label="Reset zoom"
					tooltip="Reset zoom"
					variant="ghost"
					size="sm"
					isIconOnly
					icon={<Icon icon={RotateCcw} size="sm" />}
					isDisabled={zoomIndex === fitZoomIndex}
					onClick={() => changeZoom(fitZoomIndex)}
				/>
			</HStack>
			<VStack
				as="section"
				ref={viewport}
				className="genielm-mermaid-viewport"
				hAlign="start"
				width="100%"
				isScrollable
				aria-label={`${title} viewport`}
				tabIndex={zoom > 1 ? 0 : undefined}
				data-zoomed={zoom > 1 ? "" : undefined}
				onPointerDown={startPan}
				onPointerMove={pan}
				onPointerUp={stopPan}
				onPointerCancel={stopPan}
				onLostPointerCapture={stopPan}
			>
				<img
					src={src}
					alt={title}
					width={Math.max(1, Math.floor(width * fit * zoom))}
					height={Math.max(1, Math.floor(height * fit * zoom))}
					draggable={false}
				/>
			</VStack>
		</VStack>
	);
}
