
'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  FileDown,
  History,
  Calendar as CalendarIcon,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  subscribeToAllLogs,
  UnifiedLog,
} from '@/lib/services/activityLogService';
import { Badge } from '@/components/ui/badge';
import * as xlsx from 'xlsx';
import { format } from 'date-fns';
import { UserContext } from '@/app/dashboard/layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type LogTypeFilter = 'all' | 'inbound' | 'warehouse' | 'opname';
const ROWS_PER_PAGE = 10;

export default function ActivityLoggingPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [logs, setLogs] = React.useState<UnifiedLog[]>([]);
  const [filteredLogs, setFilteredLogs] = React.useState<UnifiedLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  // Filtering states
  const [logType, setLogType] = React.useState<LogTypeFilter>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  
  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportDateRange, setExportDateRange] = React.useState<DateRange | undefined>();

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);


  React.useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    const storeIdToQuery = user.email === 'superadmin@caliloops.com' ? selectedStoreId : user.storeId || null;

    // For regular users, if they don't have a storeId, they see nothing.
    if (user.email !== 'superadmin@caliloops.com' && !user.storeId) {
        setLogs([]);
        setFilteredLogs([]);
        setLoading(false);
        return;
    }
    
    const unsubscribe = subscribeToAllLogs(
      storeIdToQuery,
      (allLogs) => {
        setLogs(allLogs);
        setLoading(false);
      },
      (error) => {
        toast({
          title: 'Error loading activity logs',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast, user, selectedStoreId]);

  React.useEffect(() => {
    let tempLogs = [...logs];

    // Filter by log type
    if (logType !== 'all') {
      tempLogs = tempLogs.filter((log) => log.type.toLowerCase() === logType);
    }

    // Filter by date range
    if (dateRange?.from) {
      tempLogs = tempLogs.filter((log) => log.datetime >= dateRange.from!);
    }
    if (dateRange?.to) {
      // Set to end of day for inclusive range
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      tempLogs = tempLogs.filter((log) => log.datetime <= toDate);
    }

    setFilteredLogs(tempLogs);
    setCurrentPage(1);
  }, [logs, logType, dateRange]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLogs.length / ROWS_PER_PAGE);
  const paginatedLogs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (totalPages > maxPagesToShow && endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        items.push(<PaginationItem key="first"><PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink></PaginationItem>);
        if (startPage > 2) {
            items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        items.push(
            <PaginationItem key={i}>
                <PaginationLink onClick={() => handlePageChange(i)} isActive={currentPage === i}>{i}</PaginationLink>
            </PaginationItem>
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>);
        }
        items.push(<PaginationItem key="last"><PaginationLink onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationLink></PaginationItem>);
    }
    return items;
  };


  const handleExport = () => {
    if (!permissions?.canExportLogs && !permissions?.hasFullAccess) {
        toast({ title: "Permission Denied", variant: "destructive"});
        return;
    }
    if (!exportDateRange?.from || !exportDateRange?.to) {
        toast({ title: "Please select a date range to export.", variant: 'destructive' });
        return;
    }

    setIsExporting(true);

    let logsToExport = logs.filter((log) => {
        const logDate = log.datetime;
        const fromDate = new Date(exportDateRange.from!);
        const toDate = new Date(exportDateRange.to!);
        toDate.setHours(23, 59, 59, 999);
        return logDate >= fromDate && logDate <= toDate;
    });

    if (logsToExport.length === 0) {
      toast({ title: 'No logs to export for the selected date range.', variant: 'destructive' });
      setIsExporting(false);
      return;
    }

    const dataToExport = logsToExport.map((log) => ({
      Datetime: log.datetime.toLocaleString(),
      Type: log.type,
      SKU: log.sku,
      Details: log.details,
      User: log.user,
      Status: log.status,
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');
    xlsx.writeFile(
      workbook,
      `activity-logs-${new Date().toISOString()}.xlsx`
    );
    setIsExporting(false);
    setIsExportModalOpen(false);
    toast({ title: "Export successful!" });
  };

  const getBadgeVariant = (
    type: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'Inbound':
        return 'default';
      case 'Warehouse':
        return 'secondary';
      case 'Opname':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History /> Activity Logging
          </h1>
          <p className="text-muted-foreground">
            Review system and user activity logs across all modules.
          </p>
        </div>
         {(permissions?.canExportLogs || permissions?.hasFullAccess) && (
            <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                <DialogTrigger asChild>
                    <Button
                    size="sm"
                    variant="outline"
                    >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export Activity Logs</DialogTitle>
                        <DialogDescription>
                            Select a date range to export the activity logs.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            id="date"
                            variant={'outline'}
                            className="w-full justify-start text-left font-normal"
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {exportDateRange?.from ? (
                                exportDateRange.to ? (
                                <>
                                    {format(exportDateRange.from, 'LLL dd, y')} -{' '}
                                    {format(exportDateRange.to, 'LLL dd, y')}
                                </>
                                ) : (
                                format(exportDateRange.from, 'LLL dd, y')
                                )
                            ) : (
                                <span>Pick a date range</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={exportDateRange?.from}
                            selected={exportDateRange}
                            onSelect={setExportDateRange}
                            numberOfMonths={2}
                            />
                        </PopoverContent>
                        </Popover>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            Export
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
          )}
      </div>
       {user?.storeId === undefined && user.email !== 'superadmin@caliloops.com' && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Store Assigned</AlertTitle>
            <AlertDescription>
                You are not assigned to a store. Please contact an administrator to assign you to a store to view activity logs.
            </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>All Logs</CardTitle>
            <CardDescription>
              A unified timeline of all warehouse activities for the selected store.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 pt-4 md:pt-0">
            <Select
              value={logType}
              onValueChange={(value) => setLogType(value as LogTypeFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Log Types</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="warehouse">Warehouse I/O</SelectItem>
                <SelectItem value="opname">Stock Opname</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className="w-[300px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'LLL dd, y')} -{' '}
                        {format(dateRange.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(dateRange.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">
                      Loading logs...
                    </p>
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No logs found for the selected store and filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.datetime.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(log.type)}>
                        {log.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.sku}</TableCell>
                    <TableCell>{log.details}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>
                      {log.status && (
                        <Badge
                          variant={
                            log.status.includes('OK')
                              ? 'success'
                              : 'destructive'
                          }
                        >
                          {log.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-6">
            <div className="text-sm text-muted-foreground">
                Showing{' '}
                <strong>
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredLogs.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredLogs.length)}</strong> of{' '}
                <strong>{filteredLogs.length}</strong> logs
            </div>
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} aria-disabled={currentPage === 1} />
                        </PaginationItem>
                        {getPaginationItems()}
                        <PaginationItem>
                            <PaginationNext onClick={() => handlePageChange(currentPage + 1)} aria-disabled={currentPage === totalPages} />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
