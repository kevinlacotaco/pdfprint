import { SortDirection } from "@tanstack/react-table";

export type HeaderCellProps = {
    title: string;
    sorted?: SortDirection | false;
    className?: string,
};

export const HeaderCell =
    ({ title, sorted = false }: HeaderCellProps) => {
        return (
            <div
                className="py-1.5 font-semibold"
            >
                {title}
                {{
                    asc: (<svg className="inline p-1 w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 8">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7 7.674 1.3a.91.91 0 0 0-1.348 0L1 7" />
                    </svg>),
                    desc: (<svg className="inline p-1 w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 8">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 5.326 5.7a.909.909 0 0 0 1.348 0L13 1" />
                    </svg>),
                }[sorted as string] ?? null}
            </div>
        );
    };