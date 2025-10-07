
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import {
  Package,
  Users,
  ArrowRightLeft,
  ClipboardCheck,
  PackageCheck,
  PackageX,
  AlertTriangle,
  LogIn,
  FileOutput,
} from 'lucide-react';

const stockStatusData = [
  { status: 'In Stock', items: 1872, fill: 'var(--color-inStock)' },
  { status: 'Low Stock', items: 125, fill: 'var(--color-lowStock)' },
  { status: 'Out of Stock', items: 38, fill: 'var(--color-outOfStock)' },
];

const stockStatusChartConfig = {
  items: {
    label: 'Items',
  },
  inStock: {
    label: 'In Stock',
    color: 'hsl(var(--chart-2))',
  },
  lowStock: {
    label: 'Low Stock',
    color: 'hsl(var(--chart-4))',
  },
  outOfStock: {
    label: 'Out of Stock',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

const userActivityData = [
  { date: 'Mon', logins: 5, signups: 1 },
  { date: 'Tue', logins: 8, signups: 2 },
  { date: 'Wed', logins: 12, signups: 3 },
  { date: 'Thu', logins: 7, signups: 1 },
  { date: 'Fri', logins: 15, signups: 4 },
  { date: 'Sat', logins: 22, signups: 5 },
  { date: 'Sun', logins: 18, signups: 3 },
];

const userActivityChartConfig = {
  logins: {
    label: 'Logins',
    color: 'hsl(var(--chart-1))',
  },
  signups: {
    label: 'New Users',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const recentActivities = [
    { id: 1, type: 'INBOUND', details: 'PO-12345: Received 50 units of MAYA-HITAM', user: 'admin', time: '2m ago' },
    { id: 2, type: 'OUTBOUND', details: 'User john.doe marked CA-MAYA-HITAM-F5G8H as OUT', user: 'john.doe', time: '5m ago' },
    { id: 3, type: 'OPNAME', details: 'Stock Opname for BANDOW-MAYA completed. Status: OK', user: 'admin', time: '30m ago' },
    { id: 4, type: 'USER_MGMT', details: 'New user "jane.doe" added to "Warehouse Staff" role', user: 'superadmin', time: '1h ago' },
    { id: 5, type: 'ALERT', details: 'MAYA-MERAH is low on stock (5 pcs remaining)', user: 'System', time: '2h ago' },
];

const getBadgeVariant = (
    type: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'INBOUND': return 'default';
      case 'OUTBOUND': return 'secondary';
      case 'OPNAME': return 'outline';
      case 'USER_MGMT': return 'default';
      case 'ALERT': return 'destructive';
      default: return 'default';
    }
  };

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Items In Stock
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1872</div>
            <p className="text-xs text-muted-foreground">
              Across 45 unique SKUs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users Today
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">22</div>
            <p className="text-xs text-muted-foreground">
              +5 from yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions (24h)</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">152</div>
            <p className="text-xs text-muted-foreground">
              98 Outbound, 54 Inbound
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Opname Accuracy</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">
              Average from last 5 opnames
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>User Activity This Week</CardTitle>
            <CardDescription>
              A visual summary of user logins and new signups.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={userActivityChartConfig} className="h-[250px] w-full">
              <AreaChart accessibilityLayer data={userActivityData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  dataKey="logins"
                  type="natural"
                  fill="var(--color-logins)"
                  fillOpacity={0.4}
                  stroke="var(--color-logins)"
                />
                 <Area
                  dataKey="signups"
                  type="natural"
                  fill="var(--color-signups)"
                  fillOpacity={0.4}
                  stroke="var(--color-signups)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock Status</CardTitle>
             <CardDescription>
              Current inventory levels across all items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stockStatusChartConfig} className="mx-auto aspect-square max-h-[250px]">
                <BarChart accessibilityLayer data={stockStatusData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="status"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar dataKey="items" radius={8} />
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-5">
         <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
                A live feed of the latest actions across the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className='text-right'>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Badge variant={getBadgeVariant(activity.type)}>{activity.type}</Badge>
                      </TableCell>
                      <TableCell>{activity.details}</TableCell>
                      <TableCell className='font-mono text-xs'>{activity.user}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{activity.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Warehouse Performance</CardTitle>
                <CardDescription>Key operational metrics for today.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className='flex items-center'>
                    <PackageCheck className='h-6 w-6 mr-4 text-green-500'/>
                    <div>
                        <p className='font-medium'>Inbound Items</p>
                        <p className='text-2xl font-bold'>2,405</p>
                    </div>
                </div>
                 <div className='flex items-center'>
                    <PackageX className='h-6 w-6 mr-4 text-red-500'/>
                    <div>
                        <p className='font-medium'>Outbound Items</p>
                        <p className='text-2xl font-bold'>1,830</p>
                    </div>
                </div>
                 <div className='flex items-center'>
                    <AlertTriangle className='h-6 w-6 mr-4 text-yellow-500'/>
                    <div>
                        <p className='font-medium'>Items Flagged as Lost</p>
                        <p className='text-2xl font-bold'>3</p>
                    </div>
                </div>
                 <div className='flex items-center'>
                    <LogIn className='h-6 w-6 mr-4 text-blue-500'/>
                    <div>
                        <p className='font-medium'>Barcode Generation</p>
                        <p className='text-2xl font-bold'>2,450</p>
                    </div>
                </div>
                 <div className='flex items-center'>
                    <FileOutput className='h-6 w-6 mr-4 text-gray-500'/>
                    <div>
                        <p className='font-medium'>Logs Exported</p>
                        <p className='text-2xl font-bold'>12</p>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}

    
