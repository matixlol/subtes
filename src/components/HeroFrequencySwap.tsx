import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type HeroFrequencyLine = {
    code: string;
    path: string;
    color: string;
    ink: string;
    magnitudeLabel: string;
    firstPeriodLabel: string;
};

type Props = {
    lines: HeroFrequencyLine[];
};

const SWAP_MS = 5000;
const MOTION_TRANSITION = {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1] as const,
};

const getInitialIndex = (lines: HeroFrequencyLine[]) => {
    const lineBIndex = lines.findIndex((line) => line.code === "B");
    return lineBIndex === -1 ? 0 : lineBIndex;
};

const joinClassNames = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" ");

function VerticalSwapText(props: {
    value: string;
    className?: string;
    itemClassName?: string;
}) {
    const { value, className, itemClassName } = props;
    const reduceMotion = useReducedMotion();

    if (reduceMotion) {
        return (
            <span className={className}>
                <span className={itemClassName}>{value}</span>
            </span>
        );
    }

    return (
        <span
            className={joinClassNames(
                "relative inline-flex h-[1em] items-center overflow-hidden align-top",
                className,
            )}
        >
            <span
                aria-hidden="true"
                className={joinClassNames("invisible whitespace-nowrap", itemClassName)}
            >
                {value}
            </span>
            <AnimatePresence initial={false} mode="sync">
                <motion.span
                    key={value}
                    initial={{ y: "-115%", opacity: 0 }}
                    animate={{ y: "0%", opacity: 1 }}
                    exit={{ y: "115%", opacity: 0 }}
                    transition={MOTION_TRANSITION}
                    className={joinClassNames(
                        "absolute inset-0 flex items-center justify-center whitespace-nowrap",
                        itemClassName,
                    )}
                >
                    {value}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

export default function HeroFrequencySwap({ lines }: Props) {
    const initialIndex = getInitialIndex(lines);
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    useEffect(() => {
        if (lines.length < 2) return undefined;

        const intervalId = window.setInterval(() => {
            setActiveIndex((currentIndex) => (currentIndex + 1) % lines.length);
        }, SWAP_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [lines.length]);

    const currentLine = lines[activeIndex] ?? lines[initialIndex] ?? null;

    if (!currentLine) {
        return (
            <>
                <span className="hero-frequency-line block">La frecuencia del</span>
                <span className="hero-frequency-line block">subte empeoró</span>
                <span className="hero-frequency-line block">desde 2019.</span>
            </>
        );
    }

    return (
        <>
            <span className="hero-frequency-line block">La frecuencia del</span>
            <span className="hero-frequency-line block">
                <span className="whitespace-nowrap">
                    subte{" "}
                    <a
                        href={currentLine.path}
                        aria-label={`Ir a Línea ${currentLine.code}`}
                        data-astro-prefetch="true"
                        className="inline-line-link"
                        style={
                            {
                                "--line-button-color": currentLine.color,
                                "--line-button-ink": currentLine.ink,
                            } as CSSProperties
                        }
                    >
                        <span className="inline-line-link__top">
                            <VerticalSwapText
                                value={currentLine.code}
                                className="w-full justify-center"
                                itemClassName="inline-line-link__label"
                            />
                        </span>
                    </a>{" "}
                    empeoró
                </span>
            </span>
            <span className="hero-frequency-line block">
                <motion.span
                    layout
                    transition={MOTION_TRANSITION}
                    className="inline-flex items-baseline gap-[0.14em] whitespace-nowrap"
                >
                    <motion.span
                        layout
                        transition={MOTION_TRANSITION}
                        className="inline-flex rounded-[0.14em] bg-[#f4e4a7] px-[0.18em] pb-[0.03em] text-[#1b1816]"
                    >
                        <VerticalSwapText
                            value={currentLine.magnitudeLabel}
                            className="w-full justify-center"
                            itemClassName="leading-none"
                        />
                    </motion.span>
                    <motion.span layout transition={MOTION_TRANSITION}>
                        desde {currentLine.firstPeriodLabel}.
                    </motion.span>
                </motion.span>
            </span>
        </>
    );
}
